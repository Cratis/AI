// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Cratis.AI.Usage;
using Cratis.AI.Workers;

namespace WorkerCacheFixture;

/// <summary>
/// Exercises generated runtime cache mounts in real Docker containers, without an agent or credentials.
/// Kubernetes PVC mounts are translated to Docker binds; this is not a live cluster test.
/// </summary>
public static class Program
{
    const string MemoryKey = "v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const string OtherKey = "v1-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const string Image = "alpine/git@sha256:a4bb51f1a3553df194ce679fc1db721d8bfba2046fa1a88fe9d4ac551ffbce25";

    /// <summary>
    /// Checks scoped, absent and restricted cache access for both runtimes.
    /// </summary>
    /// <returns>The asynchronous fixture execution.</returns>
    public static async Task Main()
    {
        var cache = Path.Combine(Environment.CurrentDirectory, ".ai-work", $"ai-cache-fixture-{Guid.NewGuid():N}");
        var repository = Path.Combine(cache, "outside", "private.git");
        Directory.CreateDirectory(repository);
        try
        {
            await Run("git", ["init", repository]);
            await File.WriteAllTextAsync(Path.Combine(repository, "sentinel"), "out-of-grant-source");
            await Run("git", ["-C", repository, "add", "sentinel"]);
            await Run("git", ["-C", repository, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "Seed sentinel"]);
            await SeedScopedCache(new DirectoryInfo(cache), new DirectoryInfo(repository));
            foreach (var runtime in new[] { "Docker", "Kubernetes" })
            {
                foreach (var mode in new[] { "scoped", "restricted", "absent" })
                {
                    await CheckCache(runtime, mode, new DirectoryInfo(cache));
                }
            }
            await CheckHostWorkspace(new DirectoryInfo(cache), new DirectoryInfo(repository));
            Console.WriteLine("Checked 6 runtime/container cache cases and 1 Docker host-prepared bind.");
        }
        finally
        {
            Directory.Delete(cache, true);
        }
    }

    static async Task SeedScopedCache(DirectoryInfo cacheDirectory, DirectoryInfo repositoryDirectory)
    {
        var cache = cacheDirectory.FullName;
        var repository = repositoryDirectory.FullName;
        Directory.CreateDirectory(Path.Combine(cache, "owner"));
        await Run("git", ["clone", "--bare", repository, Path.Combine(cache, "owner", "allowed.git")]);
        foreach (var key in new[] { MemoryKey, OtherKey, "Cratis" })
        {
            var directory = Path.Combine(cache, ".agent-memory", key);
            Directory.CreateDirectory(directory);
            await File.WriteAllTextAsync(Path.Combine(directory, "memory.jsonl"), "seed\n");
            if (!OperatingSystem.IsWindows())
            {
                // Fixture-only ownership setup lets uid 1655 append to its selected memory file.
                const UnixFileMode directoryMode = UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute | UnixFileMode.GroupRead | UnixFileMode.GroupWrite | UnixFileMode.GroupExecute | UnixFileMode.OtherRead | UnixFileMode.OtherWrite | UnixFileMode.OtherExecute;
                const UnixFileMode fileMode = UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead | UnixFileMode.GroupWrite | UnixFileMode.OtherRead | UnixFileMode.OtherWrite;
                File.SetUnixFileMode(directory, directoryMode);
                File.SetUnixFileMode(Path.Combine(directory, "memory.jsonl"), fileMode);
            }
        }
    }

    static async Task CheckCache(string runtime, string mode, DirectoryInfo cacheDirectory)
    {
        var cache = cacheDirectory.FullName;
        var environment = new Dictionary<string, string> { ["DIRECT_REPOSITORY_CACHE"] = "/ignored", ["DIRECT_MEMORY_PATH"] = "/ignored" };
        if (mode == "restricted") environment["DIRECT_REPOSITORY_CHECKOUTS"] = "[]";
        var job = new WorkerJob(AgentSessionId.New(), Image, environment, new Dictionary<string, string>())
        {
            Cache = mode == "absent" ? null : new(MemoryKey, ["owner/allowed.git"])
        };
        var arguments = new List<string> { "run", "--rm", "--network", "none", "--user", "1655:1655", "--entrypoint", "sh" };
        AddCacheArguments(arguments, runtime, job, cacheDirectory);
        var check = mode == "scoped" ? ScopedCheck(cacheDirectory) :
            $"test -z \"${{DIRECT_REPOSITORY_CACHE+x}}\" && test -z \"${{DIRECT_MEMORY_PATH+x}}\" && ! test -e '{cache}'";
        arguments.AddRange([job.Image, "-c", check]);
        await Run("docker", arguments);
        if (mode == "scoped")
        {
            if (!(await File.ReadAllTextAsync(Path.Combine(cache, ".agent-memory", MemoryKey, "memory.jsonl"))).Contains("own-memory", StringComparison.Ordinal) ||
                await File.ReadAllTextAsync(Path.Combine(cache, ".agent-memory", OtherKey, "memory.jsonl")) != "seed\n")
            {
                throw new FixtureFailed("scoped memory persistence", 1);
            }
        }
        Console.WriteLine($"PASS {runtime} cache mode={mode}");
    }

    static void AddCacheArguments(List<string> arguments, string runtime, WorkerJob job, DirectoryInfo cacheDirectory)
    {
        var cache = cacheDirectory.FullName;
        if (runtime == "Docker")
        {
            var repository = Path.Combine(cache, "owner", "allowed.git");
            var memory = Path.Combine(cache, ".agent-memory", MemoryKey);
            var specification = DockerWorkerRuntime.BuildContainerSpecificationWithCacheBinds(
                job,
                [$"{repository}:{repository}:ro", $"{memory}:{memory}:rw"],
                cache,
                "DIRECT_REPOSITORY_CACHE");
            foreach (var bind in specification.HostConfig.Binds) arguments.AddRange(["--volume", bind]);
            foreach (var variable in specification.Env) arguments.AddRange(["--env", variable]);
            return;
        }
        AddKubernetesArguments(arguments, job, cacheDirectory);
    }

    static void AddKubernetesArguments(List<string> arguments, WorkerJob job, DirectoryInfo cacheDirectory)
    {
        var cache = cacheDirectory.FullName;
        var pod = KubernetesWorkerRuntime.BuildJobSpecification(job, cache, "cache", "DIRECT_REPOSITORY_CACHE").Spec.Template.Spec;
        foreach (var mount in pod.Containers[0].VolumeMounts.Where(mount => mount.Name == "cache"))
        {
            if (string.IsNullOrEmpty(mount.SubPath)) throw new FixtureFailed("cache subPath", 1);
            var source = Path.Combine(cache, mount.SubPath);
            arguments.AddRange(["--volume", $"{source}:{mount.MountPath}:{(mount.ReadOnlyProperty == true ? "ro" : "rw")}"]);
        }
        foreach (var variable in pod.Containers[0].Env) arguments.AddRange(["--env", $"{variable.Name}={variable.Value}"]);
    }

    static string ScopedCheck(DirectoryInfo cacheDirectory)
    {
        var cache = cacheDirectory.FullName;
        var repository = $"{cache}/owner/allowed.git";
        return $"git -c safe.directory='{repository}' clone --shared '{repository}' /tmp/checkout && " +
            "test \"$(cat /tmp/checkout/sentinel)\" = out-of-grant-source && " +
            "echo local > /tmp/checkout/local && git -C /tmp/checkout add local && " +
            "git -C /tmp/checkout -c user.name=Fixture -c user.email=fixture@example.invalid commit -m local && " +
            $"! test -e '{cache}/outside/private.git' && ! test -e '{cache}/.agent-memory/{OtherKey}' && ! test -e '{cache}/.agent-memory/Cratis' && " +
            $"! touch '{repository}/worker-write' && ! sh -c \"echo change >> '{repository}/config'\" && " +
            $"test \"$DIRECT_MEMORY_PATH\" = '{cache}/.agent-memory/{MemoryKey}/memory.jsonl' && echo own-memory >> \"$DIRECT_MEMORY_PATH\"";
    }

    static async Task CheckHostWorkspace(DirectoryInfo cacheDirectory, DirectoryInfo repositoryDirectory)
    {
        var cache = cacheDirectory.FullName;
        var repository = repositoryDirectory.FullName;
        var job = new WorkerJob(
            AgentSessionId.New(),
            "alpine/git@sha256:a4bb51f1a3553df194ce679fc1db721d8bfba2046fa1a88fe9d4ac551ffbce25",
            new Dictionary<string, string>
            {
                ["CRATIS_WORKSPACE_MODE"] = "host-prepared",
                ["CRATIS_WORKSPACE_HOST_PATH"] = repository
            },
            new Dictionary<string, string>());
        var specification = DockerWorkerRuntime.BuildContainerSpecification(job, cache, "DIRECT_REPOSITORY_CACHE", repository);
        var arguments = new List<string> { "run", "--rm", "--network", "none", "--entrypoint", "sh" };
        foreach (var bind in specification.HostConfig.Binds)
        {
            arguments.AddRange(["--volume", bind]);
        }
        foreach (var variable in specification.Env)
        {
            arguments.AddRange(["--env", variable]);
        }
        arguments.AddRange([job.Image, "-c",
            "test \"$CRATIS_WORKSPACE_MODE\" = host-prepared && test \"$CRATIS_WORKSPACE_PATH\" = /workspace && " +
            $"test -z \"${{CRATIS_WORKSPACE_HOST_PATH+x}}\" && test -z \"${{DIRECT_REPOSITORY_CACHE+x}}\" && ! test -e '{cache}' && " +
            "test \"$(git -c safe.directory='*' -C /workspace show HEAD:sentinel)\" = out-of-grant-source && " +
            "! git -c safe.directory='*' -C /workspace config core.fsmonitor malicious && " +
            "! touch /workspace/.git/hooks/worker-hook && ! touch /workspace/.git/commondir && " +
            "! mkdir /workspace/.git/modules && ! mv /workspace/.git /workspace/replaced-git && " +
            "echo host-written > /workspace/sentinel"]);
        await Run("docker", arguments);
        if ((await File.ReadAllTextAsync(Path.Combine(repository, "sentinel"))).Trim() != "host-written")
        {
            throw new FixtureFailed("host-prepared write-back", 1);
        }
        Console.WriteLine("PASS Docker host-prepared: git metadata read-only, cache absent, uncommitted host write-back verified");
    }

    static async Task Run(string executable, IEnumerable<string> arguments)
    {
        var start = new ProcessStartInfo(executable) { UseShellExecute = false };
        foreach (var argument in arguments)
        {
            start.ArgumentList.Add(argument);
        }
        using var process = Process.Start(start)!;
        await process.WaitForExitAsync();
        if (process.ExitCode != 0)
        {
            throw new FixtureFailed(executable, process.ExitCode);
        }
    }
}

/// <summary>
/// The exception that is thrown when a fixture subprocess fails.
/// </summary>
/// <param name="executable">The failed subprocess.</param>
/// <param name="exitCode">Its exit code.</param>
public class FixtureFailed(string executable, int exitCode) : Exception($"{executable} failed with exit code {exitCode}");

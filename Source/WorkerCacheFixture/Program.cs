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
    /// <summary>
    /// Seeds an out-of-grant repository and checks normal and restricted containers for both runtimes.
    /// </summary>
    /// <returns>The asynchronous fixture execution.</returns>
    public static async Task Main()
    {
        var cache = Path.Combine(Path.GetTempPath(), $"ai-cache-fixture-{Guid.NewGuid():N}");
        var repository = Path.Combine(cache, "outside", "private.git");
        Directory.CreateDirectory(repository);
        try
        {
            await Run("git", ["init", repository]);
            await File.WriteAllTextAsync(Path.Combine(repository, "sentinel"), "out-of-grant-source");
            await Run("git", ["-C", repository, "add", "sentinel"]);
            await Run("git", ["-C", repository, "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "Seed sentinel"]);
            foreach (var runtime in new[] { "Docker", "Kubernetes" })
            {
                foreach (var restricted in new[] { false, true })
                {
                    var environment = new Dictionary<string, string> { ["DIRECT_REPOSITORY_CACHE"] = cache };
                    if (restricted)
                    {
                        environment["DIRECT_REPOSITORY_CHECKOUTS"] = "[]";
                    }
                    var job = new WorkerJob(AgentSessionId.New(), "alpine/git@sha256:a4bb51f1a3553df194ce679fc1db721d8bfba2046fa1a88fe9d4ac551ffbce25", environment, new Dictionary<string, string>());
                    var arguments = new List<string> { "run", "--rm", "--network", "none", "--entrypoint", "sh" };
                    if (runtime == "Docker")
                    {
                        var specification = DockerWorkerRuntime.BuildContainerSpecification(job, cache, "DIRECT_REPOSITORY_CACHE");
                        foreach (var bind in specification.HostConfig.Binds)
                        {
                            arguments.AddRange(["--volume", bind]);
                        }
                        foreach (var variable in specification.Env)
                        {
                            arguments.AddRange(["--env", variable]);
                        }
                    }
                    else
                    {
                        var pod = KubernetesWorkerRuntime.BuildJobSpecification(job, cache, "cache", "DIRECT_REPOSITORY_CACHE").Spec.Template.Spec;
                        foreach (var volume in pod.Volumes.Where(volume => volume.PersistentVolumeClaim is not null))
                        {
                            var mount = pod.Containers[0].VolumeMounts.Single(mount => mount.Name == volume.Name);
                            arguments.AddRange(["--volume", $"{cache}:{mount.MountPath}:ro"]);
                        }
                        foreach (var variable in pod.Containers[0].Env)
                        {
                            arguments.AddRange(["--env", $"{variable.Name}={variable.Value}"]);
                        }
                    }
                    var read = $"git -c safe.directory='*' -C '{repository}' show HEAD:sentinel";
                    var check = restricted
                        ? $"test -z \"${{DIRECT_REPOSITORY_CACHE+x}}\" && ! test -e '{cache}' && ! {read}"
                        : $"test \"$DIRECT_REPOSITORY_CACHE\" = '{cache}' && test \"$({read})\" = out-of-grant-source";
                    arguments.AddRange([job.Image, "-c", check]);
                    await Run("docker", arguments);
                    Console.WriteLine($"PASS {runtime} restricted={restricted}: cache sentinel {(restricted ? "inaccessible" : "readable")}");
                }
            }
            Console.WriteLine("Checked 4 runtime/container cases against 1 out-of-grant sentinel repository.");
        }
        finally
        {
            Directory.Delete(cache, true);
        }
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

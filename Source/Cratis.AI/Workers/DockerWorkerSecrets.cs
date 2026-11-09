// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using Docker.DotNet;
using Docker.DotNet.Models;

namespace Cratis.AI.Workers;

/// <summary>
/// Delivers Docker credentials only after a private memory-backed mount has been verified.
/// </summary>
/// <param name="client">The Docker client.</param>
/// <param name="container">The running container.</param>
/// <param name="cancellationToken">The cancellation token.</param>
internal sealed class DockerWorkerSecrets(IDockerClient client, string container, CancellationToken cancellationToken)
{
    const string ExecutionPath = "PATH=/usr/sbin:/usr/bin:/sbin:/bin";

    /// <summary>
    /// Builds an in-memory payload without a readiness marker.
    /// </summary>
    /// <param name="job">The payload to deliver.</param>
    /// <returns>The files to deliver.</returns>
    /// <exception cref="DockerWorkerLaunchFailed">The payload is invalid.</exception>
    internal static IReadOnlyDictionary<string, string> BuildPayload(WorkerJob job)
    {
        var files = new Dictionary<string, string>
        {
            [WorkerSecrets.FileName] = WorkerSecrets.Render(job.Secrets),
            [WorkerPromptFile.FileName] = WorkerPromptFile.Clamp(job.EnvironmentVariables.GetValueOrDefault(WorkerPromptFile.LegacyVariableName, string.Empty))
        };
        foreach (var (name, content) in job.ConfigurationFiles ?? new Dictionary<string, string>())
        {
            if (!IsConfigurationName(name))
            {
                throw new DockerWorkerLaunchFailed();
            }
            files.Add(name, content);
        }
        return files;
    }

    /// <summary>
    /// Installs and verifies the payload before releasing the entrypoint gate.
    /// </summary>
    /// <param name="job">The payload to deliver.</param>
    /// <returns>The delivery task.</returns>
    internal async Task Inject(WorkerJob job)
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(20));
        var files = BuildPayload(job);

        // Exec resolves paths inside the mounted container namespace; no archive API or layer write.
        await Execute($"test ! -L {WorkerSecrets.Directory} && test \"$(/usr/bin/stat -f -c %T {WorkerSecrets.Directory})\" = tmpfs && test \"$(/usr/bin/stat -c %u:%a {WorkerSecrets.Directory})\" = 1655:700 && test ! -L {WorkerSecrets.DockerReadyDirectory} && test \"$(/usr/bin/stat -f -c %T {WorkerSecrets.DockerReadyDirectory})\" = tmpfs && test \"$(/usr/bin/stat -c %u:%a {WorkerSecrets.DockerReadyDirectory})\" = 0:755 && test ! -w {WorkerSecrets.DockerReadyDirectory} && test ! -e {WorkerSecrets.DockerReadyPath}", deadline.Token);
        foreach (var (name, content) in files)
        {
            await WriteFile(name, content, deadline.Token);
        }
        await Execute($"test \"$(/usr/bin/stat -c %u:%a {WorkerSecrets.Directory})\" = 1655:700 && test -r {WorkerSecrets.Path} && invalid=$(/usr/bin/find {WorkerSecrets.Directory} -mindepth 1 \\( ! -type f -o ! -user 1655 -o ! -group 1655 -o ! -perm 0400 \\) -print) && test -z \"$invalid\"", deadline.Token);

        // A separate final operation: partial delivery or a failed check cannot release the gate.
        // Publication is the commit point. Any subsequent transport/inspect ambiguity fails and removes
        // the container, but cannot promise that a worker did not briefly observe the committed marker.
        await Execute($"umask 077; printf 'ready\\n' > {WorkerSecrets.DockerPendingReadyPath} && /usr/bin/chmod 0444 {WorkerSecrets.DockerPendingReadyPath} && /usr/bin/mv {WorkerSecrets.DockerPendingReadyPath} {WorkerSecrets.DockerReadyPath}", deadline.Token, user: "0:0");
    }

    static bool IsConfigurationName(string name) => name switch
    {
        "" or "." or ".." or WorkerSecrets.PendingReadyFileName or WorkerSecrets.FileName or WorkerSecrets.ReadyFileName or WorkerPromptFile.FileName => false,
        { Length: > 100 } => false,
        _ => name.All(IsFileNameCharacter)
    };

    static bool IsFileNameCharacter(char character) => char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-';

    async Task WriteFile(string name, string content, CancellationToken token)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        var path = $"{WorkerSecrets.Directory}/{name}";
        try
        {
            // Bound stdin by byte count rather than relying on transport-specific half-close support.
            // A short write fails the size check. Only the length and validated path enter argv.
            await Execute($"umask 077; /usr/bin/head -c {bytes.Length} > '{path}' && test \"$(/usr/bin/stat -c %s '{path}')\" = {bytes.Length} && /usr/bin/chmod 0400 '{path}'", token, bytes);
        }
        finally
        {
            Array.Clear(bytes);
        }
    }

    async Task Execute(string command, CancellationToken token, byte[]? input = null, string user = "1655:1655")
    {
        var execution = await client.Exec.CreateContainerExecAsync(
            container,
            new ContainerExecCreateParameters
            {
                User = user,
                AttachStdin = input is not null,
                AttachStdout = true,
                AttachStderr = true,

                // Docker merges Env with the container environment. Clear that inherited state
                // before starting the shell; the launch filter rejects loader/shell overrides too.
                Env = [ExecutionPath],
                Cmd = ["/usr/bin/env", "-i", ExecutionPath, "/bin/sh", "-c", command]
            },
            token);
        using var stream = await client.Exec.StartContainerExecAsync(execution.ID, new ContainerExecStartParameters(), token);
        if (input is not null)
        {
            await stream.WriteAsync(input, 0, input.Length, token);
            stream.CloseWrite();
        }

        // Drain without retaining or reporting untrusted output, then allow inspect state to settle.
        await stream.CopyOutputToAsync(Stream.Null, Stream.Null, Stream.Null, token);
        await VerifyCompletion(execution.ID, token);
    }

    async Task VerifyCompletion(string execution, CancellationToken token)
    {
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var result = await client.Exec.InspectContainerExecAsync(execution, token);
            if (!result.Running && result.ExitCode is { } exitCode)
            {
                if (exitCode != 0)
                {
                    throw new DockerWorkerLaunchFailed();
                }
                return;
            }

            // Infrastructure readiness backoff: EOF may precede the engine's terminal inspect state.
            await Task.Delay(TimeSpan.FromMilliseconds(25), token);
        }
        throw new DockerWorkerLaunchFailed();
    }
}

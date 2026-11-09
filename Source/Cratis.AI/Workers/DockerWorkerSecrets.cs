// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Formats.Tar;
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
    /// <summary>
    /// Builds an in-memory payload without a readiness marker.
    /// </summary>
    /// <param name="job">The payload to deliver.</param>
    /// <returns>The archive positioned for reading.</returns>
    /// <exception cref="DockerWorkerLaunchFailed">The payload is invalid.</exception>
    internal static MemoryStream BuildArchive(WorkerJob job)
    {
        var stream = new MemoryStream();
        try
        {
            using (var writer = new TarWriter(stream, TarEntryFormat.Ustar, leaveOpen: true))
            {
                WriteEntry(writer, WorkerSecrets.FileName, WorkerSecrets.Render(job.Secrets));
                WriteEntry(writer, WorkerPromptFile.FileName, WorkerPromptFile.Clamp(job.EnvironmentVariables.GetValueOrDefault(WorkerPromptFile.LegacyVariableName, string.Empty)));
                foreach (var (name, content) in job.ConfigurationFiles ?? new Dictionary<string, string>())
                {
                    if (!IsConfigurationName(name))
                    {
                        throw new DockerWorkerLaunchFailed();
                    }
                    WriteEntry(writer, name, content);
                }
            }
            stream.Position = 0;
            return stream;
        }
        catch (Exception)
        {
            stream.Dispose();
            throw new DockerWorkerLaunchFailed();
        }
    }

    /// <summary>
    /// Installs and verifies the payload before releasing the entrypoint gate.
    /// </summary>
    /// <param name="job">The payload to deliver.</param>
    /// <returns>The delivery task.</returns>
    internal async Task Inject(WorkerJob job)
    {
        // Check the live mount before sending any credentials. Never fall back to the writable layer.
        await Execute($"test ! -L {WorkerSecrets.Directory} && test \"$(stat -f -c %T {WorkerSecrets.Directory})\" = tmpfs && test \"$(stat -c %u:%a {WorkerSecrets.Directory})\" = 1655:700");
        await using var archive = BuildArchive(job);
        await client.Containers.ExtractArchiveToContainerAsync(
            container, new CopyToContainerParameters { Path = WorkerSecrets.Directory, CopyUIDGID = true }, archive, cancellationToken);

        // Preserve archive ownership, then verify the actual result as the worker. No root exec
        // or capabilities are needed, and unexpected ownership/modes fail rather than fall back.
        await Execute($"test \"$(stat -c %u:%a {WorkerSecrets.Directory})\" = 1655:700 && test -r {WorkerSecrets.Path} && invalid=$(find {WorkerSecrets.Directory} -mindepth 1 \\( ! -type f -o ! -user 1655 -o ! -perm 0400 \\) -print) && test -z \"$invalid\"");

        // A separate final operation: no partial archive or failed permission check can release the gate.
        await Execute($"umask 077; printf 'ready\\n' > {WorkerSecrets.PendingReadyPath} && chmod 0400 {WorkerSecrets.PendingReadyPath} && mv {WorkerSecrets.PendingReadyPath} {WorkerSecrets.ReadyPath}");
    }

    static void WriteEntry(TarWriter writer, string name, string content)
    {
        using var data = new MemoryStream(Encoding.UTF8.GetBytes(content));
        writer.WriteEntry(new UstarTarEntry(TarEntryType.RegularFile, name)
        {
            Uid = 1655,
            Gid = 1655,
            Mode = UnixFileMode.UserRead,
            DataStream = data
        });
    }

    static bool IsConfigurationName(string name) => name switch
    {
        "" or "." or ".." or WorkerSecrets.PendingReadyFileName or WorkerSecrets.FileName or WorkerSecrets.ReadyFileName or WorkerPromptFile.FileName => false,
        { Length: > 100 } => false,
        _ => name.All(IsFileNameCharacter)
    };

    static bool IsFileNameCharacter(char character) => char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-';

    async Task Execute(string command)
    {
        // Commands contain only fixed paths and permissions, never secret values. Do not attach
        // output: an engine error or an unexpected image must not echo credentials into diagnostics.
        var execution = await client.Exec.CreateContainerExecAsync(
            container,
            new ContainerExecCreateParameters
            {
                User = "1655",
                Cmd = ["/bin/sh", "-c", command]
            },
            cancellationToken);
        await client.Exec.StartContainerExecAsync(execution.ID, new ContainerExecStartParameters(), cancellationToken);
        var result = await client.Exec.InspectContainerExecAsync(execution.ID, cancellationToken);
        if (result.Running || result.ExitCode != 0)
        {
            throw new DockerWorkerLaunchFailed();
        }
    }
}

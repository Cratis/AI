// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Runtime.CompilerServices;
using System.Text;
using System.Threading.Channels;
using Docker.DotNet;
using Docker.DotNet.Models;
using Microsoft.Extensions.Options;

namespace Planner.Work.Workers;

/// <summary>
/// An <see cref="IWorkerRuntime"/> that launches worker containers directly on the Docker engine -
/// the runtime used when running and testing locally.
/// </summary>
/// <param name="options">The <see cref="ContainerRuntimeOptions"/> configuring the Docker endpoint.</param>
/// <param name="logger">The logger.</param>
public class DockerWorkerRuntime(IOptions<ContainerRuntimeOptions> options, ILogger<DockerWorkerRuntime> logger) : IWorkerRuntime
{
    /// <inheritdoc/>
    public async Task Start(WorkerJob job, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();

        var (image, tag) = SplitImage(job.Image);
        try
        {
            await client.Images.CreateImageAsync(
                new ImagesCreateParameters { FromImage = image, Tag = tag },
                null,
                new Progress<JSONMessage>(),
                cancellationToken);
        }
        catch (DockerApiException exception)
        {
            // A locally built image is not pullable - use what the daemon already has.
            logger.CouldNotPullImage(exception, job.Image);
        }

        var response = await client.Containers.CreateContainerAsync(
            new CreateContainerParameters
            {
                Image = job.Image,
                Name = ContainerNameFor(job.Work),
                Env = [.. job.EnvironmentVariables.Select(variable => $"{variable.Key}={variable.Value}")],

                // A TTY keeps the log a single raw stream, which also gives the live console a
                // clean line-by-line feed. Stdin stays open so steering text can be sent to the
                // running session.
                Tty = true,
                OpenStdin = true,
                StdinOnce = false,
                HostConfig = new HostConfig
                {
                    // Lets the container reach the Planner's callback endpoint on the host from Linux
                    // engines; Docker Desktop provides the alias out of the box.
                    ExtraHosts = ["host.docker.internal:host-gateway"]
                }
            },
            cancellationToken);

        await client.Containers.StartContainerAsync(response.ID, new ContainerStartParameters(), cancellationToken);
        logger.StartedWorkerContainer(response.ID, job.Work);
    }

    /// <inheritdoc/>
    public async Task Stop(WorkId work, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        try
        {
            await client.Containers.RemoveContainerAsync(
                ContainerNameFor(work),
                new ContainerRemoveParameters { Force = true },
                cancellationToken);
            logger.StoppedWorkerContainer(work);
        }
        catch (DockerApiException exception)
        {
            // The container may already be gone - stopping is best effort.
            logger.CouldNotStopWorker(exception, work);
        }
    }

    /// <inheritdoc/>
    public async IAsyncEnumerable<string> StreamLogs(WorkId work, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        var channel = Channel.CreateUnbounded<string>();
        var pump = Task.Run(
            async () =>
            {
                try
                {
                    await client.Containers.GetContainerLogsAsync(
                        ContainerNameFor(work),
                        new ContainerLogsParameters
                        {
                            ShowStdout = true,
                            ShowStderr = true,
                            Follow = true,
                            Tail = "1000"
                        },
                        new Progress<string>(line => channel.Writer.TryWrite(line)),
                        cancellationToken);
                }
                catch (Exception exception)
                {
                    // The container may be gone or the client cancelled - the stream just ends.
                    logger.LogStreamEnded(exception, work);
                }
                finally
                {
                    channel.Writer.TryComplete();
                }
            },
            cancellationToken);

        await foreach (var line in channel.Reader.ReadAllAsync(cancellationToken))
        {
            yield return line;
        }

        await pump;
    }

    /// <inheritdoc/>
    public async Task SendInput(WorkId work, string text, CancellationToken cancellationToken = default)
    {
        using var client = CreateClient();
        using var stream = await client.Containers.AttachContainerAsync(
            ContainerNameFor(work),
            new ContainerAttachParameters { Stream = true, Stdin = true },
            cancellationToken);
        var bytes = Encoding.UTF8.GetBytes($"{text}\n");
        await stream.WriteAsync(bytes, 0, bytes.Length, cancellationToken);
    }

    static string ContainerNameFor(WorkId work) => $"planner-work-{work.Value:N}";

    static (string Image, string Tag) SplitImage(string image)
    {
        var separator = image.LastIndexOf(':');
        return separator > image.LastIndexOf('/')
            ? (image[..separator], image[(separator + 1)..])
            : (image, "latest");
    }

    DockerClient CreateClient()
    {
        // The builder resolves the endpoint the same way the docker CLI does (DOCKER_HOST, contexts,
        // platform default socket) unless an explicit endpoint is configured.
        var builder = new DockerClientBuilder();
        if (!string.IsNullOrEmpty(options.Value.DockerEndpoint))
        {
            builder = builder.WithEndpoint(new Uri(options.Value.DockerEndpoint));
        }

        return builder.Build();
    }
}

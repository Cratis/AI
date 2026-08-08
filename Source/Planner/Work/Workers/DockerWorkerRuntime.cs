// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
                Name = $"planner-work-{job.Work.Value:N}",
                Env = [.. job.EnvironmentVariables.Select(variable => $"{variable.Key}={variable.Value}")],
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

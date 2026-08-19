// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Workers;

/// <summary>
/// Describes a worker container to launch for a unit of work.
/// </summary>
/// <param name="Work">The identity of the work the container runs.</param>
/// <param name="Image">The container image to run.</param>
/// <param name="EnvironmentVariables">The non-secret environment variables handed to the container - the work id, prompt, model and callback URL.</param>
/// <param name="Secrets">The credentials the container runs with, keyed by the environment variable name the entrypoint expects.</param>
/// <remarks>
/// The two are separate because they travel differently. <paramref name="EnvironmentVariables"/> go
/// on the container specification, which anyone who can read the specification can read; secrets
/// must not, so a runtime delivers <paramref name="Secrets"/> out of band and the entrypoint reads
/// them from <see cref="WorkerSecrets.Path"/>. See <see cref="WorkerSecrets"/>.
/// </remarks>
public record WorkerJob(
    WorkId Work,
    string Image,
    IReadOnlyDictionary<string, string> EnvironmentVariables,
    IReadOnlyDictionary<string, string> Secrets);

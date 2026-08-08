// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Workers;

/// <summary>
/// Describes a worker container to launch for a unit of work.
/// </summary>
/// <param name="Work">The identity of the work the container runs.</param>
/// <param name="Image">The container image to run.</param>
/// <param name="EnvironmentVariables">The environment variables handed to the container - the work id, prompt, model, callback URL and credentials.</param>
public record WorkerJob(WorkId Work, string Image, IReadOnlyDictionary<string, string> EnvironmentVariables);

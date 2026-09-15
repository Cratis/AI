// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Workers;

/// <summary>
/// Describes a worker container to launch for an agent session. Ported from Direct's
/// <c>Work.Workers.WorkerJob</c> (plan Section 5.6), generalized from <c>WorkId</c> to
/// <see cref="AgentSessionId"/>.
/// </summary>
/// <param name="Session">The identity of the agent session the container runs.</param>
/// <param name="Image">The container image to run.</param>
/// <param name="EnvironmentVariables">The non-secret environment variables handed to the container - the session id, prompt, model and callback URL.</param>
/// <param name="Secrets">The credentials the container runs with, keyed by the environment variable name the entrypoint expects.</param>
/// <param name="ConfigurationFiles">Non-secret per-run configuration files mounted read-only into the worker.</param>
/// <remarks>
/// The two are separate because they travel differently. <paramref name="EnvironmentVariables"/> go
/// on the container specification, which anyone who can read the specification can read; secrets
/// must not, so a runtime delivers <paramref name="Secrets"/> out of band and the entrypoint reads
/// them from the secrets mount path a consumer's worker image agrees on.
/// </remarks>
public record WorkerJob(
    AgentSessionId Session,
    string Image,
    IReadOnlyDictionary<string, string> EnvironmentVariables,
    IReadOnlyDictionary<string, string> Secrets,
    IReadOnlyDictionary<string, string>? ConfigurationFiles = null);

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work.Workers;

/// <summary>
/// What a unit of work needs to run, separated by how it is allowed to travel.
/// </summary>
/// <param name="Variables">The non-secret configuration, safe to put on the container specification.</param>
/// <param name="Secrets">The credentials, which must reach the container out of band.</param>
/// <remarks>
/// The separation is the security property: a value in <paramref name="Variables"/> ends up in
/// <c>kubectl get job -o yaml</c> and <c>docker inspect</c>, so anything that authenticates
/// belongs in <paramref name="Secrets"/>. Both are keyed by the environment variable name the
/// entrypoint expects, so where a value travels is a delivery decision rather than a rename.
/// </remarks>
public record WorkerEnvironmentResult(
    IReadOnlyDictionary<string, string> Variables,
    IReadOnlyDictionary<string, string> Secrets);

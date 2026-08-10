// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;

namespace Planner.Operations;

/// <summary>
/// What the frontend is allowed to know about the operational configuration - the default
/// repository for operational issues, and which kinds of access an investigating agent has. A plain
/// configuration snapshot, not a Chronicle projection.
/// </summary>
/// <remarks>
/// Deliberately carries no credential material. Whether a kubeconfig is configured is useful on
/// screen; the kubeconfig itself has no business leaving the server.
/// </remarks>
/// <param name="DefaultIssueRepository">The repository operational issues default to - <see cref="RepositoryId.NotSet"/> when none is configured.</param>
/// <param name="HasKubernetes">Whether the agent can reach a Kubernetes cluster.</param>
/// <param name="HasDocker">Whether the agent can reach a Docker daemon.</param>
/// <param name="HasLogs">Whether the agent can query logs.</param>
/// <param name="HasDashboards">Whether the agent can query Grafana.</param>
[ReadModel]
public record OperationsSettings(
    RepositoryId DefaultIssueRepository,
    bool HasKubernetes,
    bool HasDocker,
    bool HasLogs,
    bool HasDashboards)
{
    /// <summary>
    /// Gets the current operational settings.
    /// </summary>
    /// <param name="options">The <see cref="OperationsOptions"/> operations are configured from.</param>
    /// <returns>The current settings.</returns>
    public static OperationsSettings Current(IOptions<OperationsOptions> options) => new(
        DefaultIssueRepositoryFrom(options.Value),
        !string.IsNullOrWhiteSpace(options.Value.Kubeconfig),
        !string.IsNullOrWhiteSpace(options.Value.DockerHost),
        !string.IsNullOrWhiteSpace(options.Value.LokiUrl),
        !string.IsNullOrWhiteSpace(options.Value.GrafanaUrl));

    static RepositoryId DefaultIssueRepositoryFrom(OperationsOptions options) =>
        string.IsNullOrWhiteSpace(options.IssueOwner) || string.IsNullOrWhiteSpace(options.IssueRepository)
            ? RepositoryId.NotSet
            : RepositoryId.From(options.IssueOwner, options.IssueRepository);
}

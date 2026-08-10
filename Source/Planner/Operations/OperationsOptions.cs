// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Operations;

/// <summary>
/// Represents the operational access an agent investigating an alert is given, bound from the
/// <c>Planner:Operations</c> configuration section.
/// </summary>
/// <remarks>
/// An agent asked to work out why a production system is unhappy needs to be able to look at that
/// system. What it gets here is the diagnosis surface of a Cratis deployment - the cluster, the
/// container runtime, the logs and the dashboards - and nothing else. Database credentials are
/// deliberately absent: an agent that can read a cluster and its logs can explain almost any
/// operational failure, and one that can also read the data can leak it.
/// <para>
/// Everything is optional. What is left empty is simply not handed to the worker, and the prompt
/// tells the agent which tools it actually has, so an investigation degrades to "read the code and
/// the alert" rather than failing.
/// </para>
/// </remarks>
public class OperationsOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:Operations";

    /// <summary>
    /// Gets or sets the kubeconfig, in full YAML, that worker containers get as <c>~/.kube/config</c>.
    /// Scope the credential it carries to what an investigation legitimately needs - reading pods,
    /// nodes, events and logs, and restarting a workload.
    /// </summary>
    public string Kubeconfig { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the namespace the agent works in by default.
    /// </summary>
    public string KubernetesNamespace { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Docker daemon the agent talks to, as a <c>DOCKER_HOST</c> value. Only useful
    /// where there is a daemon the worker can reach; on Kubernetes the cluster is the runtime.
    /// </summary>
    public string DockerHost { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the base URL of the Loki instance holding the logs, for instance
    /// <c>http://loki.studio.svc.cluster.local:3100</c>.
    /// </summary>
    public string LokiUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the username Loki is queried with, when it is protected.
    /// </summary>
    public string LokiUsername { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the password Loki is queried with, when it is protected.
    /// </summary>
    public string LokiPassword { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the base URL of the Grafana instance.
    /// </summary>
    public string GrafanaUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Grafana API token, for querying dashboards and data sources.
    /// </summary>
    public string GrafanaToken { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the repositories cloned for an alert investigation, as <c>owner/name</c> - the
    /// code behind the system that is alerting. Empty means the agent investigates the running
    /// system without any source to read.
    /// </summary>
    public IList<string> Repositories { get; set; } = [];

    /// <summary>
    /// Gets or sets the organization owning the repository operational issues are created in by
    /// default when an alert is turned into an issue.
    /// </summary>
    public string IssueOwner { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the repository operational issues are created in by default.
    /// </summary>
    public string IssueRepository { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets deployment-specific standing instructions appended to every alert investigation
    /// prompt - the things a runbook would tell a person on call.
    /// </summary>
    public string Runbook { get; set; } = string.Empty;

    /// <summary>
    /// Gets whether the agent has any way of reaching the running system at all.
    /// </summary>
    public bool HasOperationalAccess =>
        !string.IsNullOrWhiteSpace(Kubeconfig) ||
        !string.IsNullOrWhiteSpace(DockerHost) ||
        !string.IsNullOrWhiteSpace(LokiUrl);
}

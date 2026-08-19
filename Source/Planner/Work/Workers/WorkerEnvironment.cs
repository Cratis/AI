// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;
using Planner.Accounts.Credentials;
using Planner.Alerts;
using Planner.GitHub;
using Planner.GitHub.App;
using Planner.GitHub.GitIdentity;
using Planner.GitHub.GitIdentity.Listing;
using Planner.Issues.Grouping;
using Planner.Issues.Grouping.Listing;
using Planner.Operations;
using Planner.Repositories.Listing;
using Planner.Work.Callback;
using Planner.Work.Listing;
using ListedAlert = Planner.Alerts.Listing.Alert;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.Workers;

/// <summary>
/// The default <see cref="IWorkerEnvironment"/> - resolves what a unit of work needs to run from the
/// read models and configuration, and hands it to the container as environment variables.
/// </summary>
/// <param name="readModels">The <see cref="IReadModels"/> for keyed lookups (repositories, git identity, groups, alerts).</param>
/// <param name="gitHubAppTokenResolver">Resolves the GitHub App installation token handed to workers.</param>
/// <param name="workerOptions">The worker configuration.</param>
/// <param name="operationsOptions">The operational access an alert investigation is given.</param>
public class WorkerEnvironment(
    IReadModels readModels,
    IGitHubAppTokenResolver gitHubAppTokenResolver,
    IOptions<WorkerOptions> workerOptions,
    IOptions<OperationsOptions> operationsOptions) : IWorkerEnvironment
{
    /// <inheritdoc/>
    public async Task<WorkerEnvironmentResult> Build(
        WorkItem work,
        IReadOnlyList<ListedIssue> coveredIssues,
        AccountCredentials credentials,
        ModelName model,
        CallbackToken callbackToken,
        CancellationToken cancellationToken = default)
    {
        var environment = new Dictionary<string, string>
        {
            ["PLANNER_WORK_ID"] = work.Id.Value.ToString(),
            ["PLANNER_MODEL"] = model.Value,
            ["PLANNER_CALLBACK_URL"] = $"{workerOptions.Value.CallbackBaseUrl.TrimEnd('/')}/api/work/{work.Id.Value}/callback",
            ["PLANNER_BRANCH"] = $"planner/work-{work.Id.Value:N}"
        };

        // Everything that authenticates goes here instead of onto the container specification.
        var secrets = new Dictionary<string, string>
        {
            ["PLANNER_CALLBACK_TOKEN"] = callbackToken.Value,
            ["CLAUDE_CODE_OAUTH_TOKEN"] = credentials.Token.Value
        };

        // A fresh deployment should never be stuck without a commit identity - fall back to the
        // Planner's own AI identity rather than leaving worker commits unattributed.
        var gitIdentity = await readModels.GetInstanceById<ConfiguredGitIdentity>((EventSourceId)GitIdentityId.Default);
        environment["PLANNER_GIT_USER_NAME"] = gitIdentity?.Name.Value ?? AIIdentity.DefaultGitUserName.Value;
        environment["PLANNER_GIT_USER_EMAIL"] = gitIdentity?.Email.Value ?? AIIdentity.DefaultGitUserEmail.Value;

        return work.Purpose switch
        {
            WorkPurpose.AdHoc => await BuildAdHoc(work, environment, secrets, cancellationToken),
            WorkPurpose.AlertInvestigation => await BuildAlertInvestigation(work, environment, secrets, cancellationToken),
            _ => await BuildForIssues(work, coveredIssues, environment, secrets, cancellationToken)
        };
    }

    static void AddOperationalAccess(
        Dictionary<string, string> environment,
        Dictionary<string, string> secrets,
        OperationsOptions operations)
    {
        // Endpoints and namespaces say where to look; only the four below say who you are.
        Add(environment, "PLANNER_KUBE_NAMESPACE", operations.KubernetesNamespace);
        Add(environment, "DOCKER_HOST", operations.DockerHost);
        Add(environment, "PLANNER_LOKI_URL", operations.LokiUrl);
        Add(environment, "PLANNER_GRAFANA_URL", operations.GrafanaUrl);

        // The kubeconfig carries a cluster credential, and the Loki username identifies the account
        // its password unlocks - both belong with the secrets rather than beside them.
        Add(secrets, "PLANNER_KUBECONFIG", operations.Kubeconfig);
        Add(secrets, "PLANNER_LOKI_USERNAME", operations.LokiUsername);
        Add(secrets, "PLANNER_LOKI_PASSWORD", operations.LokiPassword);
        Add(secrets, "PLANNER_GRAFANA_TOKEN", operations.GrafanaToken);

        static void Add(Dictionary<string, string> target, string name, string value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                target[name] = value;
            }
        }
    }

    static bool IsGroup(GroupId? group) => group is not null && group != GroupId.NotSet;

    async Task<WorkerEnvironmentResult> BuildAdHoc(
        WorkItem work,
        Dictionary<string, string> environment,
        Dictionary<string, string> secrets,
        CancellationToken cancellationToken)
    {
        var urls = new List<string>();
        OrganizationName? tokenOwner = null;
        foreach (var repositoryId in work.Repositories ?? [])
        {
            var repository = await readModels.GetInstanceById<Repository>((EventSourceId)repositoryId);
            if (repository is not null && repository.Owner != OrganizationName.NotSet)
            {
                var owner = repository.CodeOwner ?? repository.Owner;
                var name = repository.CodeName ?? repository.Name;
                urls.Add($"https://github.com/{owner.Value}/{name.Value}.git");

                // Worker containers commit through a single GITHUB_TOKEN, so ad-hoc work
                // spanning repositories under different installations authenticates as the
                // first one - a known limitation of the one-token-per-container model.
                tokenOwner ??= owner;
            }
        }

        environment["PLANNER_REPOSITORY_URLS"] = string.Join(' ', urls);
        environment["PLANNER_PROMPT"] = WorkerPrompts.BuildAdHoc(work);
        if (tokenOwner is not null)
        {
            secrets["GITHUB_TOKEN"] = await gitHubAppTokenResolver.GetToken(tokenOwner, cancellationToken);
        }

        return new(environment, secrets);
    }

    async Task<WorkerEnvironmentResult> BuildAlertInvestigation(
        WorkItem work,
        Dictionary<string, string> environment,
        Dictionary<string, string> secrets,
        CancellationToken cancellationToken)
    {
        var operations = operationsOptions.Value;
        var alert = work.Alert is null ? null : await readModels.GetInstanceById<ListedAlert>((EventSourceId)work.Alert);

        // An alert investigation is about a running system rather than a repository, so what gets
        // cloned is whatever source the deployment says explains it - and nothing at all is a valid
        // answer. The agent still has the alert, and whatever operational access is configured.
        var urls = new List<string>();
        OrganizationName? tokenOwner = null;
        foreach (var slug in operations.Repositories)
        {
            var parts = slug.Split('/', 2, StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length != 2)
            {
                continue;
            }

            urls.Add($"https://github.com/{parts[0]}/{parts[1]}.git");
            tokenOwner ??= new OrganizationName(parts[0]);
        }

        if (urls.Count > 0)
        {
            environment["PLANNER_REPOSITORY_URLS"] = string.Join(' ', urls);
        }

        if (tokenOwner is not null)
        {
            secrets["GITHUB_TOKEN"] = await gitHubAppTokenResolver.GetToken(tokenOwner, cancellationToken);
        }

        environment["PLANNER_PROMPT"] = WorkerPrompts.BuildAlertInvestigation(alert, operations);
        AddOperationalAccess(environment, secrets, operations);
        return new(environment, secrets);
    }

    async Task<WorkerEnvironmentResult> BuildForIssues(
        WorkItem work,
        IReadOnlyList<ListedIssue> coveredIssues,
        Dictionary<string, string> environment,
        Dictionary<string, string> secrets,
        CancellationToken cancellationToken)
    {
        var first = coveredIssues[0];
        var issueRepository = await readModels.GetInstanceById<Repository>((EventSourceId)RepositoryId.From(first.Owner, first.Repository));
        var codeOwner = issueRepository?.CodeOwner ?? first.Owner;
        var codeName = issueRepository?.CodeName ?? first.Repository;

        // When the work covers a whole group, its instructions travel with the prompt.
        WorkPrompt? groupPrompt = null;
        var groups = coveredIssues.Select(issue => issue.Group).Where(IsGroup).Distinct().ToList();
        if (groups.Count == 1)
        {
            var group = await readModels.GetInstanceById<Group>((EventSourceId)groups[0]!);
            groupPrompt = group?.Prompt;
        }

        environment["PLANNER_REPOSITORY_URL"] = $"https://github.com/{codeOwner.Value}/{codeName.Value}.git";
        environment["PLANNER_PROMPT"] = WorkerPrompts.Build(work, coveredIssues, groupPrompt);
        secrets["GITHUB_TOKEN"] = await gitHubAppTokenResolver.GetToken(codeOwner, cancellationToken);
        return new(environment, secrets);
    }
}

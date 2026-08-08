// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Planner.Accounts;
using Planner.Accounts.Credentials;
using Planner.Accounts.Listing;
using Planner.GitHub;
using Planner.Issues.Grouping;
using Planner.Issues.Grouping.Listing;
using Planner.Repositories.Listing;
using Planner.Work.Listing;
using Planner.Work.Starting;
using Planner.Work.Workers;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.Scheduling;

/// <summary>
/// The default <see cref="IWorkDispatcher"/> - reads the issue, work and account read models,
/// schedules implementation work for ready issues and launches worker containers for scheduled
/// work within each account's capacity and plan limits.
/// </summary>
/// <param name="workItems">The work item read models.</param>
/// <param name="issues">The issue read models.</param>
/// <param name="accounts">The account read models.</param>
/// <param name="readModels">The <see cref="IReadModels"/> for keyed lookups (credentials, repositories).</param>
/// <param name="workerRuntime">The <see cref="IWorkerRuntime"/> that launches worker containers.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> for usage-window calculations.</param>
/// <param name="workerOptions">The worker configuration.</param>
/// <param name="schedulingOptions">The scheduling boundaries.</param>
/// <param name="gitHubOptions">The GitHub configuration - the token handed to workers.</param>
/// <param name="logger">The logger.</param>
public class WorkDispatcher(
    IMongoCollection<WorkItem> workItems,
    IMongoCollection<ListedIssue> issues,
    IMongoCollection<ClaudeAccount> accounts,
    IReadModels readModels,
    IWorkerRuntime workerRuntime,
    ICommandPipeline commandPipeline,
    TimeProvider timeProvider,
    IOptions<WorkerOptions> workerOptions,
    IOptions<SchedulingOptions> schedulingOptions,
    IOptions<GitHubOptions> gitHubOptions,
    ILogger<WorkDispatcher> logger) : IWorkDispatcher
{
    static readonly TimeSpan _fiveHours = TimeSpan.FromHours(5);
    static readonly TimeSpan _oneWeek = TimeSpan.FromDays(7);

    /// <inheritdoc/>
    public async Task RunSchedulingPass(CancellationToken cancellationToken = default)
    {
        var openWork = await Find(workItems, work => work.Status == WorkStatus.Scheduled || work.Status == WorkStatus.Running, cancellationToken);
        await ScheduleReadyIssues(openWork, cancellationToken);
        await DispatchPendingWork(cancellationToken);
    }

    static bool IsGrouped(ListedIssue issue) => IsGroup(issue.Group);

    static bool IsGroup(GroupId? group) => group is not null && group != GroupId.NotSet;

    static Task<IReadOnlyList<T>> Find<T>(IMongoCollection<T> collection, Expression<Func<T, bool>> predicate, CancellationToken cancellationToken) =>
        Find(collection, (FilterDefinition<T>)predicate, cancellationToken);

    static async Task<IReadOnlyList<T>> Find<T>(IMongoCollection<T> collection, FilterDefinition<T> filter, CancellationToken cancellationToken)
    {
        var cursor = await collection.FindAsync(filter, cancellationToken: cancellationToken);
        return await cursor.ToListAsync(cancellationToken);
    }

    async Task ScheduleReadyIssues(IReadOnlyList<WorkItem> openWork, CancellationToken cancellationToken)
    {
        var covered = openWork.SelectMany(work => work.Issues).ToHashSet();
        var ready = await Find(issues, issue => issue.Status == Issues.IssueStatus.ReadyForDevelopment && issue.IsOpen, cancellationToken);
        var candidates = ready.Where(issue => !covered.Contains(issue.Id)).ToList();

        foreach (var issue in candidates.Where(issue => !IsGrouped(issue)))
        {
            await commandPipeline.Execute(new ScheduleWork(WorkPurpose.Implementation, [issue.Id], issue.SuggestedModel));
        }

        foreach (var group in candidates.Where(IsGrouped).GroupBy(issue => issue.Group))
        {
            var members = await Find(issues, issue => issue.Group == group.Key && issue.IsOpen, cancellationToken);

            // A grouped issue waits until every issue in the group is ready to go and none of them
            // is already covered by open work.
            var allReady = members.All(member => member.Status == Issues.IssueStatus.ReadyForDevelopment && !covered.Contains(member.Id));
            if (allReady && members.Count > 0)
            {
                var model = members.Select(member => member.SuggestedModel).FirstOrDefault(suggested => suggested is not null);
                await commandPipeline.Execute(new ScheduleWork(WorkPurpose.Implementation, members.Select(member => member.Id), model));
            }
        }
    }

    async Task DispatchPendingWork(CancellationToken cancellationToken)
    {
        var pending = await Find(workItems, work => work.Status == WorkStatus.Scheduled, cancellationToken);
        if (pending.Count == 0)
        {
            return;
        }

        var allAccounts = await Find(accounts, account => account.HasToken, cancellationToken);
        var running = (await Find(workItems, work => work.Status == WorkStatus.Running, cancellationToken)).ToList();

        foreach (var work in pending)
        {
            var account = await SelectAccount(work, allAccounts, running, cancellationToken);
            if (account is null)
            {
                logger.NoCapacity(pending.Count);
                return;
            }

            if (await Dispatch(work, account, cancellationToken))
            {
                running.Add(work with { Account = account.Id, Status = WorkStatus.Running, StartedAt = timeProvider.GetUtcNow() });
            }
        }
    }

    async Task<bool> Dispatch(WorkItem work, ClaudeAccount account, CancellationToken cancellationToken)
    {
        var credentials = await readModels.GetInstanceById<AccountCredentials>((EventSourceId)account.Id);
        if (credentials is null)
        {
            logger.AccountWithoutCredentials(account.Name);
            return false;
        }

        var workIssues = (work.Issues ?? []).ToList();
        var coveredIssues = await Find(issues, issue => workIssues.Contains(issue.Id), cancellationToken);
        if (work.Purpose != WorkPurpose.AdHoc && coveredIssues.Count == 0)
        {
            logger.WorkWithoutIssues(work.Id);
            return false;
        }

        var model = ResolveModel(work, coveredIssues);
        var environment = await BuildEnvironment(work, coveredIssues, credentials, model);

        try
        {
            await workerRuntime.Start(new WorkerJob(work.Id, workerOptions.Value.Image, environment), cancellationToken);
        }
        catch (Exception exception)
        {
            logger.CouldNotLaunchWorker(exception, work.Id);
            await commandPipeline.Execute(new Failing.FailWork(work.Id, $"Could not launch worker: {exception.Message}"));
            return false;
        }

        await commandPipeline.Execute(new StartWork(work.Id, account.Id, model));
        return true;
    }

    async Task<Dictionary<string, string>> BuildEnvironment(
        WorkItem work,
        IReadOnlyList<ListedIssue> coveredIssues,
        AccountCredentials credentials,
        ModelName model)
    {
        var environment = new Dictionary<string, string>
        {
            ["PLANNER_WORK_ID"] = work.Id.Value.ToString(),
            ["PLANNER_MODEL"] = model.Value,
            ["PLANNER_CALLBACK_URL"] = $"{workerOptions.Value.CallbackBaseUrl.TrimEnd('/')}/api/work/{work.Id.Value}/callback",
            ["PLANNER_BRANCH"] = $"planner/work-{work.Id.Value:N}",
            ["CLAUDE_CODE_OAUTH_TOKEN"] = credentials.Token.Value,
            ["GITHUB_TOKEN"] = gitHubOptions.Value.Token
        };

        if (work.Purpose == WorkPurpose.AdHoc)
        {
            var urls = new List<string>();
            foreach (var repositoryId in work.Repositories ?? [])
            {
                var repository = await readModels.GetInstanceById<Repository>((EventSourceId)repositoryId);
                if (repository is not null && repository.Owner != OrganizationName.NotSet)
                {
                    var owner = repository.CodeOwner ?? repository.Owner;
                    var name = repository.CodeName ?? repository.Name;
                    urls.Add($"https://github.com/{owner.Value}/{name.Value}.git");
                }
            }

            environment["PLANNER_REPOSITORY_URLS"] = string.Join(' ', urls);
            environment["PLANNER_PROMPT"] = WorkerPrompts.BuildAdHoc(work);
            return environment;
        }

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
        return environment;
    }

    ModelName ResolveModel(WorkItem work, IReadOnlyList<ListedIssue> coveredIssues)
    {
        if (work.Model != ModelName.NotSet)
        {
            return work.Model;
        }

        if (work.Purpose == WorkPurpose.Investigation)
        {
            return schedulingOptions.Value.InvestigationModel;
        }

        if (work.Purpose == WorkPurpose.AdHoc)
        {
            return schedulingOptions.Value.DefaultModel;
        }

        return coveredIssues.Select(issue => issue.SuggestedModel).FirstOrDefault(suggested => suggested is not null)
            ?? new ModelName(schedulingOptions.Value.DefaultModel);
    }

    async Task<ClaudeAccount?> SelectAccount(
        WorkItem work,
        IReadOnlyList<ClaudeAccount> allAccounts,
        IReadOnlyList<WorkItem> running,
        CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var fiveHourCutoff = now - _fiveHours;
        var weekCutoff = now - _oneWeek;
        var candidates = new List<(ClaudeAccount Account, bool Owned, double FiveHourRatio, double WeekRatio)>();

        foreach (var account in allAccounts)
        {
            if (running.Count(item => item.Account == account.Id) >= schedulingOptions.Value.MaxConcurrentWorkPerAccount)
            {
                continue;
            }

            var limits = schedulingOptions.Value.LimitsFor(account.Plan);
            var startedLastFiveHours = await workItems.CountDocumentsAsync(
                item => item.Account == account.Id && item.StartedAt >= fiveHourCutoff,
                cancellationToken: cancellationToken);
            if (startedLastFiveHours >= limits.SessionsPerFiveHours)
            {
                continue;
            }

            var startedLastWeek = await workItems.CountDocumentsAsync(
                item => item.Account == account.Id && item.StartedAt >= weekCutoff,
                cancellationToken: cancellationToken);
            if (startedLastWeek >= limits.SessionsPerWeek)
            {
                continue;
            }

            var owned = work.RequestedBy != UserName.NotSet && account.RegisteredBy == work.RequestedBy;
            candidates.Add((
                account,
                owned,
                (double)startedLastFiveHours / limits.SessionsPerFiveHours,
                (double)startedLastWeek / limits.SessionsPerWeek));
        }

        // Work a user scheduled prefers that user's own account(s); beyond that - and for pooled
        // work from automation - pick the account with the most headroom left in its windows.
        return candidates
            .OrderByDescending(candidate => candidate.Owned)
            .ThenBy(candidate => candidate.FiveHourRatio)
            .ThenBy(candidate => candidate.WeekRatio)
            .Select(candidate => candidate.Account)
            .FirstOrDefault();
    }
}

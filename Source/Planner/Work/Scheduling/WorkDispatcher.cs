// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Planner.Accounts;
using Planner.Accounts.Credentials;
using Planner.Accounts.Listing;
using Planner.Alerts;
using Planner.Issues.Grouping;
using Planner.Work.Callback;
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
/// <param name="readModels">The <see cref="IReadModels"/> for keyed lookups (credentials).</param>
/// <param name="workerRuntime">The <see cref="IWorkerRuntime"/> that launches worker containers.</param>
/// <param name="workerEnvironment">Builds the environment a worker container runs with.</param>
/// <param name="callbackTokens">Issues the bearer token a launched worker's callbacks authenticate with.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> for usage-window calculations.</param>
/// <param name="workerOptions">The worker configuration.</param>
/// <param name="schedulingOptions">The scheduling boundaries.</param>
/// <param name="alertOptions">The alert configuration - carries the model alerts are investigated with.</param>
/// <param name="logger">The logger.</param>
public class WorkDispatcher(
    IMongoCollection<WorkItem> workItems,
    IMongoCollection<ListedIssue> issues,
    IMongoCollection<ClaudeAccount> accounts,
    IReadModels readModels,
    IWorkerRuntime workerRuntime,
    IWorkerEnvironment workerEnvironment,
    IWorkerCallbackTokens callbackTokens,
    ICommandPipeline commandPipeline,
    TimeProvider timeProvider,
    IOptions<WorkerOptions> workerOptions,
    IOptions<SchedulingOptions> schedulingOptions,
    IOptions<AlertOptions> alertOptions,
    ILogger<WorkDispatcher> logger) : IWorkDispatcher
{
    static readonly TimeSpan _fiveHours = TimeSpan.FromHours(5);
    static readonly TimeSpan _oneWeek = TimeSpan.FromDays(7);

    /// <inheritdoc/>
    public async Task RunSchedulingPass(CancellationToken cancellationToken = default)
    {
        var openWork = await Find(workItems, work => work.Status == WorkStatus.Scheduled || work.Status == WorkStatus.Running, cancellationToken);
        await SweepStuckWork(openWork, cancellationToken);
        await ScheduleReadyIssues(openWork, cancellationToken);
        await DispatchPendingWork(cancellationToken);
    }

    static bool IsGrouped(ListedIssue issue) => IsGroup(issue.Group);

    static bool IsGroup(GroupId? group) => group is not null && group != GroupId.NotSet;

    /// <summary>
    /// Whether a unit of work is about issues at all. Ad-hoc work and alert investigations are not,
    /// so an empty issue set is expected for them rather than a reason to refuse the dispatch.
    /// </summary>
    /// <param name="work">The work being dispatched.</param>
    /// <returns><see langword="true"/> when the work covers issues.</returns>
    static bool CoversIssues(WorkItem work) =>
        work.Purpose is not (WorkPurpose.AdHoc or WorkPurpose.AlertInvestigation);

    static ModelName? EffectiveModel(ListedIssue issue) =>
        issue.OverriddenModel is { } overridden && overridden != ModelName.NotSet ? overridden : issue.SuggestedModel;

    /// <summary>
    /// The highest explicit priority among a unit of work's covered issues. Work that covers no
    /// issues (ad-hoc, alert investigations) is treated as <see cref="Issues.Priority.Normal"/> so it
    /// competes on equal footing rather than always losing to any issue with a priority set at all.
    /// </summary>
    /// <param name="work">The unit of work to weigh.</param>
    /// <param name="issuesById">The covered issues, keyed by identity.</param>
    /// <returns>The effective <see cref="Issues.Priority"/>.</returns>
    static Issues.Priority EffectivePriority(WorkItem work, Dictionary<IssueId, ListedIssue> issuesById)
    {
        var covered = (work.Issues ?? []).Where(issuesById.ContainsKey).ToList();
        return covered.Count == 0 ? Issues.Priority.Normal : covered.Max(issue => issuesById[issue].Priority);
    }

    /// <summary>
    /// The lowest manual sort order among a unit of work's covered issues - the tie-breaker once
    /// priority is equal. Work with no ordered issue sorts last among its priority tier.
    /// </summary>
    /// <param name="work">The unit of work to weigh.</param>
    /// <param name="issuesById">The covered issues, keyed by identity.</param>
    /// <returns>The effective sort order.</returns>
    static double EffectiveOrder(WorkItem work, Dictionary<IssueId, ListedIssue> issuesById)
    {
        var orders = (work.Issues ?? [])
            .Where(issuesById.ContainsKey)
            .Select(issue => issuesById[issue].Order)
            .Where(order => order is not null)
            .Select(order => order!.Value)
            .ToList();
        return orders.Count == 0 ? double.MaxValue : orders.Min();
    }

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

    /// <summary>
    /// Fails any unit of work that has been running longer than
    /// <see cref="SchedulingOptions.MaxRunningDuration"/> without reporting - the only recovery for a
    /// worker container that died without reporting (an OOM kill, a node eviction, a crash) rather
    /// than a human noticing and stopping it by hand. There is no way to ask the worker runtime
    /// whether a container is still alive, so this is duration-only - see
    /// <see cref="SchedulingOptions.MaxRunningDuration"/> for why the default is deliberately
    /// generous. A zero or negative duration disables the sweep entirely.
    /// </summary>
    /// <param name="openWork">The currently scheduled and running work.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>Awaitable task.</returns>
    async Task SweepStuckWork(IReadOnlyList<WorkItem> openWork, CancellationToken cancellationToken)
    {
        var maxDuration = schedulingOptions.Value.MaxRunningDuration;
        if (maxDuration <= TimeSpan.Zero)
        {
            return;
        }

        var now = timeProvider.GetUtcNow();
        var stuck = openWork.Where(work =>
            work.Status == WorkStatus.Running &&
            work.StartedAt is { } startedAt &&
            now - startedAt > maxDuration);

        foreach (var work in stuck)
        {
            logger.SweepingStuckWork(work.Id, maxDuration);

            // Best effort - if the container is genuinely still alive despite the deadline, this
            // makes sure it actually stops rather than being orphaned while its work item is failed.
            await workerRuntime.Stop(work.Id, cancellationToken);

            // Every other terminal path retires the per-work callback token explicitly - the launch
            // failure below, the callback endpoint and StopWork all do. A swept item is terminal too,
            // so its token goes with it rather than staying valid until it ages out.
            callbackTokens.Revoke(work.Id);

            await commandPipeline.Execute(new Failing.FailWork(
                work.Id,
                $"Swept after running longer than the configured maximum of {maxDuration} without reporting - presumed dead rather than genuinely failed."));
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
        var ordered = await OrderByPriority(pending, cancellationToken);

        foreach (var work in ordered)
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

    /// <summary>
    /// Orders pending work by the highest priority among the issues it covers - a group inherits the
    /// highest priority of its members this way, since it covers all of them - falling back to the
    /// covered issues' manual sort order, and finally to the order the work was found in.
    /// </summary>
    /// <param name="pending">The scheduled work waiting for capacity.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The work, ordered highest priority first.</returns>
    async Task<IReadOnlyList<WorkItem>> OrderByPriority(IReadOnlyList<WorkItem> pending, CancellationToken cancellationToken)
    {
        var coveredIssueIds = pending.SelectMany(work => work.Issues ?? []).ToHashSet();
        var issuesById = coveredIssueIds.Count == 0
            ? []
            : (await Find(issues, issue => coveredIssueIds.Contains(issue.Id), cancellationToken)).ToDictionary(issue => issue.Id);

        return [.. pending
            .OrderByDescending(work => EffectivePriority(work, issuesById))
            .ThenBy(work => EffectiveOrder(work, issuesById))];
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
        if (CoversIssues(work) && coveredIssues.Count == 0)
        {
            logger.WorkWithoutIssues(work.Id);
            return false;
        }

        var model = ResolveModel(work, coveredIssues);
        var callbackToken = callbackTokens.Issue(work.Id);
        var environment = await workerEnvironment.Build(work, coveredIssues, credentials, model, callbackToken, cancellationToken);

        try
        {
            await workerRuntime.Start(
                new WorkerJob(work.Id, workerOptions.Value.Image, environment.Variables, environment.Secrets),
                cancellationToken);
        }
        catch (Exception exception)
        {
            logger.CouldNotLaunchWorker(exception, work.Id);
            callbackTokens.Revoke(work.Id);
            await commandPipeline.Execute(new Failing.FailWork(work.Id, $"Could not launch worker: {exception.Message}"));
            return false;
        }

        await commandPipeline.Execute(new StartWork(work.Id, account.Id, model));
        return true;
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

        if (work.Purpose == WorkPurpose.AlertInvestigation)
        {
            return alertOptions.Value.Model;
        }

        if (work.Purpose == WorkPurpose.AdHoc)
        {
            return schedulingOptions.Value.DefaultModel;
        }

        return coveredIssues.Select(EffectiveModel).FirstOrDefault(model => model is not null)
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

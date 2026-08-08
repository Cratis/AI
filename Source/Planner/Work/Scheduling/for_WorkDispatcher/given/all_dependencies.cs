// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Planner.Accounts;
using Planner.Accounts.Credentials;
using Planner.Accounts.Listing;
using Planner.GitHub;
using Planner.Work.Listing;
using Planner.Work.Workers;
using ListedIssue = Planner.Issues.Listing.Issue;
using Repository = Planner.Repositories.Listing.Repository;

namespace Planner.Work.Scheduling.for_WorkDispatcher.given;

public class all_dependencies : Specification
{
    protected static readonly DateTimeOffset _now = new(2026, 8, 8, 12, 0, 0, TimeSpan.Zero);

    protected IMongoCollection<WorkItem> _workItems;
    protected IMongoCollection<ListedIssue> _issues;
    protected IMongoCollection<ClaudeAccount> _accounts;
    protected IReadModels _readModels;
    protected IWorkerRuntime _workerRuntime;
    protected ICommandPipeline _commandPipeline;
    protected TimeProvider _timeProvider;
    protected SchedulingOptions _schedulingOptions;
    protected WorkerOptions _workerOptions;
    protected WorkDispatcher _dispatcher;

    protected List<WorkItem> _workItemsData;
    protected List<ListedIssue> _issuesData;
    protected List<ClaudeAccount> _accountsData;

    void Establish()
    {
        _workItemsData = [];
        _issuesData = [];
        _accountsData = [];

        _workItems = CollectionOf(() => _workItemsData);
        _issues = CollectionOf(() => _issuesData);
        _accounts = CollectionOf(() => _accountsData);

        _readModels = Substitute.For<IReadModels>();
        _readModels.GetInstanceById<Repository>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>()).Returns((Repository?)null);
        _workerRuntime = Substitute.For<IWorkerRuntime>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _timeProvider = Substitute.For<TimeProvider>();
        _timeProvider.GetUtcNow().Returns(_now);

        _schedulingOptions = new();
        _workerOptions = new();

        _dispatcher = new(
            _workItems,
            _issues,
            _accounts,
            _readModels,
            _workerRuntime,
            _commandPipeline,
            _timeProvider,
            Options.Create(_workerOptions),
            Options.Create(_schedulingOptions),
            Options.Create(new GitHubOptions()),
            Substitute.For<Microsoft.Extensions.Logging.ILogger<WorkDispatcher>>());
    }

    protected ClaudeAccount AddAccountWithCredentials(ClaudePlan plan = ClaudePlan.Max20x)
    {
        var account = new ClaudeAccount(AccountId.New(), "Primary", plan, true);
        _accountsData.Add(account);
        _readModels.GetInstanceById<AccountCredentials>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(new AccountCredentials(account.Id, "sk-ant-token"));
        return account;
    }

    protected static ListedIssue Issue(string key, Issues.IssueStatus status, Issues.Grouping.GroupId? group = null, ModelName? suggestedModel = null) =>
        new(
            key,
            "Cratis",
            "Studio",
            1,
            "An issue",
            "Bug",
            "someuser",
            _now,
            AuthorAssociation.Member,
            true,
            status,
            Group: group,
            SuggestedModel: suggestedModel);

    static IMongoCollection<T> CollectionOf<T>(Func<IReadOnlyList<T>> items)
    {
        var collection = Substitute.For<IMongoCollection<T>>();
        collection.FindAsync(Arg.Any<FilterDefinition<T>>(), Arg.Any<FindOptions<T, T>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => CursorOf(Evaluate(callInfo.Arg<FilterDefinition<T>>(), items())));
        collection.CountDocumentsAsync(Arg.Any<FilterDefinition<T>>(), Arg.Any<CountOptions>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => Evaluate(callInfo.Arg<FilterDefinition<T>>(), items()).LongCount());
        return collection;
    }

    static IEnumerable<T> Evaluate<T>(FilterDefinition<T> filter, IReadOnlyList<T> items) =>
        filter switch
        {
            ExpressionFilterDefinition<T> expression => items.Where(expression.Expression.Compile()),
            _ when filter == FilterDefinition<T>.Empty => items,
            _ => items
        };

    static IAsyncCursor<T> CursorOf<T>(IEnumerable<T> items)
    {
        var materialized = items.ToList();
        var cursor = Substitute.For<IAsyncCursor<T>>();
        cursor.Current.Returns(materialized);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(true, false);
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(true), Task.FromResult(false));
        return cursor;
    }
}
#endif

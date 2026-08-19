// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using NSubstitute.ReturnsExtensions;
using Planner.Accounts;
using Planner.Accounts.Credentials;
using Planner.Accounts.Listing;
using Planner.Alerts;
using Planner.GitHub.App;
using Planner.GitHub.GitIdentity.Listing;
using Planner.Operations;
using Planner.Work.Callback;
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
    protected IWorkerEnvironment _workerEnvironment;
    protected ICommandPipeline _commandPipeline;
    protected TimeProvider _timeProvider;
    protected SchedulingOptions _schedulingOptions;
    protected WorkerOptions _workerOptions;
    protected AlertOptions _alertOptions;
    protected OperationsOptions _operationsOptions;
    protected IGitHubAppTokenResolver _gitHubAppTokenResolver;
    protected IWorkerCallbackTokens _callbackTokens;
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
        _readModels.GetInstanceById<Repository>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>()).ReturnsNull();
        _readModels.GetInstanceById<ConfiguredGitIdentity>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>()).ReturnsNull();
        _workerRuntime = Substitute.For<IWorkerRuntime>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _timeProvider = Substitute.For<TimeProvider>();
        _timeProvider.GetUtcNow().Returns(_now);

        _schedulingOptions = new();
        _workerOptions = new();
        _alertOptions = new();
        _operationsOptions = new();
        _gitHubAppTokenResolver = Substitute.For<IGitHubAppTokenResolver>();
        _gitHubAppTokenResolver.GetToken(Arg.Any<OrganizationName>(), Arg.Any<CancellationToken>()).Returns("installation-token");
        _callbackTokens = Substitute.For<IWorkerCallbackTokens>();
        _callbackTokens.Issue(Arg.Any<WorkId>()).Returns(_ => CallbackToken.New());

        // The real environment builder rather than a substitute - the specs assert on what a worker
        // container is actually handed, which is precisely what it produces.
        _workerEnvironment = new WorkerEnvironment(
            _readModels,
            _gitHubAppTokenResolver,
            Options.Create(_workerOptions),
            Options.Create(_operationsOptions));

        _dispatcher = new(
            _workItems,
            _issues,
            _accounts,
            _readModels,
            _workerRuntime,
            _workerEnvironment,
            _callbackTokens,
            _commandPipeline,
            _timeProvider,
            Options.Create(_workerOptions),
            Options.Create(_schedulingOptions),
            Options.Create(_alertOptions),
            Substitute.For<Microsoft.Extensions.Logging.ILogger<WorkDispatcher>>());
    }

    protected ClaudeAccount AddAccountWithCredentials(ClaudePlan plan = ClaudePlan.Max20x, UserName? owner = null)
    {
        var account = new ClaudeAccount(AccountId.New(), "Primary", plan, owner ?? UserName.NotSet, true);
        _accountsData.Add(account);
        _readModels.GetInstanceById<AccountCredentials>(Arg.Any<ReadModelKey>(), Arg.Any<ReadModelSessionId>())
            .Returns(new AccountCredentials(account.Id, "sk-ant-token"));
        return account;
    }

    protected static ListedIssue Issue(
        string key,
        Issues.IssueStatus status,
        Issues.Grouping.GroupId? group = null,
        ModelName? suggestedModel = null,
        ModelName? overriddenModel = null) =>
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
            SuggestedModel: suggestedModel,
            OverriddenModel: overriddenModel);

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

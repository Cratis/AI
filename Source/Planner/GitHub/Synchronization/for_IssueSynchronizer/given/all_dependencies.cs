// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Arc.Authorization;
using MongoDB.Driver;
using Planner.Repositories.Listing;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.GitHub.Synchronization.for_IssueSynchronizer.given;

public class all_dependencies : Specification
{
    protected IMongoCollection<Repository> _repositories;
    protected IMongoCollection<ListedIssue> _issues;
    protected IGitHubClient _gitHub;
    protected ICommandPipeline _commandPipeline;
    protected ISystemExecution _systemExecution;
    protected IssueSynchronizer _synchronizer;

    void Establish()
    {
        _repositories = Substitute.For<IMongoCollection<Repository>>();
        _issues = EmptyCollection();
        _gitHub = Substitute.For<IGitHubClient>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _systemExecution = Substitute.For<ISystemExecution>();

        _synchronizer = new(
            _repositories,
            _issues,
            _gitHub,
            _commandPipeline,
            _systemExecution,
            Substitute.For<Microsoft.Extensions.Logging.ILogger<IssueSynchronizer>>());
    }

    // No issues mirrored yet for any repository - the common starting point for a synchronization
    // spec, whichever repository it asks about.
    static IMongoCollection<ListedIssue> EmptyCollection()
    {
        var collection = Substitute.For<IMongoCollection<ListedIssue>>();
        var cursor = Substitute.For<IAsyncCursor<ListedIssue>>();
        cursor.Current.Returns([]);
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(true, false);
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(true), Task.FromResult(false));
        collection.FindAsync(Arg.Any<FilterDefinition<ListedIssue>>(), Arg.Any<FindOptions<ListedIssue, ListedIssue>>(), Arg.Any<CancellationToken>())
            .Returns(cursor);
        return collection;
    }
}
#endif

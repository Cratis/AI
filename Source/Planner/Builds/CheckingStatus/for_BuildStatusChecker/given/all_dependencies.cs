// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using MongoDB.Driver;
using Planner.GitHub;
using Repository = Planner.Repositories.Listing.Repository;
using Cratis.Arc.Authorization;

namespace Planner.Builds.CheckingStatus.for_BuildStatusChecker.given;

public class all_dependencies : Specification
{
    protected IMongoCollection<Repository> _repositories;
    protected IGitHubClient _gitHub;
    protected ICommandPipeline _commandPipeline;
    protected BuildStatusChecker _checker;

    protected List<Repository> _repositoriesData;

    void Establish()
    {
        _repositoriesData = [];
        _repositories = CollectionOf(() => _repositoriesData);
        _gitHub = Substitute.For<IGitHubClient>();
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _checker = new(_repositories, _gitHub, _commandPipeline, Substitute.For<ISystemExecution>(), Substitute.For<Microsoft.Extensions.Logging.ILogger<BuildStatusChecker>>());
    }

    static IMongoCollection<T> CollectionOf<T>(Func<IReadOnlyList<T>> items)
    {
        var collection = Substitute.For<IMongoCollection<T>>();
        collection.FindAsync(Arg.Any<FilterDefinition<T>>(), Arg.Any<FindOptions<T, T>>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => CursorOf(items()));
        return collection;
    }

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

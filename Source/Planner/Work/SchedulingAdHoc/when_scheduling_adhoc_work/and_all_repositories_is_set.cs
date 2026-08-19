// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Planner.Identity;
using Repository = Planner.Repositories.Listing.Repository;

namespace Planner.Work.SchedulingAdHoc.when_scheduling_adhoc_work;

public class and_all_repositories_is_set : Specification
{
    static readonly Repository _first = new(RepositoryId.From("Cratis", "Studio"), "Cratis", "Studio", null, null, Repositories.IssueSynchronizationStatus.Synchronized, string.Empty);
    static readonly Repository _second = new(RepositoryId.From("Cratis", "Chronicle"), "Cratis", "Chronicle", null, null, Repositories.IssueSynchronizationStatus.Synchronized, string.Empty);

    ICurrentUser _currentUser;
    IMongoCollection<Repository> _repositories;
    CommandScenario<ScheduleAdHocWork> _scenario;
    CommandResult _result;

    void Establish()
    {
        _currentUser = Substitute.For<ICurrentUser>();
        _currentUser.GetUserName().Returns(new UserName("einari"));

        _repositories = Substitute.For<IMongoCollection<Repository>>();
        var cursor = Substitute.For<IAsyncCursor<Repository>>();
        cursor.Current.Returns([_first, _second]);
        cursor.MoveNextAsync(Arg.Any<CancellationToken>()).Returns(Task.FromResult(true), Task.FromResult(false));
        _repositories.FindAsync(Arg.Any<FilterDefinition<Repository>>(), Arg.Any<FindOptions<Repository, Repository>>(), Arg.Any<CancellationToken>())
            .Returns(cursor);

        _scenario = new();
        _scenario.Services.AddSingleton(_currentUser);
        _scenario.Services.AddSingleton(_repositories);
    }

    async Task Because() => _result = await _scenario.Execute(
        new ScheduleAdHocWork("Upgrade all dependencies", AllRepositories: true));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_cover_every_tracked_repository() => _scenario.EventSequence.ShouldHaveAppendedEvent<AdHocWorkScheduled>(
        @event => @event.Repositories.Count() == 2);
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Planner.Identity;
using Repository = Planner.Repositories.Listing.Repository;

namespace Planner.Work.SchedulingAdHoc.when_scheduling_adhoc_work;

public class and_repositories_are_selected : Specification
{
    ICurrentUser _currentUser;
    CommandScenario<ScheduleAdHocWork> _scenario;
    CommandResult _result;

    void Establish()
    {
        _currentUser = Substitute.For<ICurrentUser>();
        _currentUser.GetUserName().Returns(new UserName("einari"));
        _scenario = new();
        _scenario.Services.AddSingleton(_currentUser);
        _scenario.Services.AddSingleton(Substitute.For<IMongoCollection<Repository>>());
    }

    async Task Because() => _result = await _scenario.Execute(
        new ScheduleAdHocWork("Upgrade all dependencies", [new RepositoryId("cratis-fundamentals"), new RepositoryId("cratis-chronicle")]));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_adhoc_work_scheduled() => _scenario.EventSequence.ShouldHaveAppendedEvent<AdHocWorkScheduled>(
        @event =>
            @event.Prompt == new WorkPrompt("Upgrade all dependencies") &&
            @event.Repositories.Count() == 2 &&
            @event.RequestedBy == new UserName("einari") &&
            !@event.Issues.Any());
}
#endif

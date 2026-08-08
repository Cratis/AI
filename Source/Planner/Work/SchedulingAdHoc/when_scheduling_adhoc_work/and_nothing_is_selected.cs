// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Planner.Identity;
using Repository = Planner.Repositories.Listing.Repository;

namespace Planner.Work.SchedulingAdHoc.when_scheduling_adhoc_work;

public class and_nothing_is_selected : Specification
{
    CommandScenario<ScheduleAdHocWork> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();
        _scenario.Services.AddSingleton(Substitute.For<ICurrentUser>());
        _scenario.Services.AddSingleton(Substitute.For<IMongoCollection<Repository>>());
    }

    async Task Because() => _result = await _scenario.Execute(new ScheduleAdHocWork("Upgrade all dependencies"));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
#endif

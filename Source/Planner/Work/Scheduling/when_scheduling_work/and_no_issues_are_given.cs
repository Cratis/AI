// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;

namespace Planner.Work.Scheduling.when_scheduling_work;

public class and_no_issues_are_given : Specification
{
    CommandScenario<ScheduleWork> _scenario;
    CommandResult _result;

    void Establish()
    {
        _scenario = new();
        var currentUser = Substitute.For<Planner.Identity.ICurrentUser>();
        currentUser.GetUserName().Returns(UserName.NotSet);
        _scenario.Services.AddSingleton(currentUser);
    }

    async Task Because() => _result = await _scenario.Execute(new ScheduleWork(WorkPurpose.Implementation, []));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
}
#endif

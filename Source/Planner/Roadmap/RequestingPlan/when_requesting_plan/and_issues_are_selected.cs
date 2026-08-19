// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.Extensions.DependencyInjection;
using Planner.Identity;

namespace Planner.Roadmap.RequestingPlan.when_requesting_plan;

public class and_issues_are_selected : Specification
{
    ICurrentUser _currentUser;
    CommandScenario<RequestPlan> _scenario;
    CommandResult _result;

    void Establish()
    {
        _currentUser = Substitute.For<ICurrentUser>();
        _currentUser.GetUserName().Returns(new UserName("einari"));
        _scenario = new();
        _scenario.Services.AddSingleton(_currentUser);
    }

    async Task Because() => _result = await _scenario.Execute(new RequestPlan(
        [new IssueId("cratis-studio-1"), new IssueId("cratis-chronicle-2")], "Prioritize the smaller repository first"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_plan_requested() => _scenario.EventSequence.ShouldHaveAppendedEvent<PlanRequested>(
        @event =>
            @event.Issues.Count() == 2 &&
            @event.Instructions == new PlanInstructions("Prioritize the smaller repository first") &&
            @event.RequestedBy == new UserName("einari"));
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Reordering.when_reordering_issue;

public class and_order_is_specified : Specification
{
    CommandScenario<ReorderIssue> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ReorderIssue("cratis-studio-256", 1.5));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_issue_reordered() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueReordered>(
        @event => @event.Order == new SortOrder(1.5));
}
#endif

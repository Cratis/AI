// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Renaming.when_renaming_issue;

public class and_title_is_valid : Specification
{
    CommandScenario<RenameIssue> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RenameIssue("cratis-studio-256", "A better title"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_issue_renamed() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueRenamed>(
        @event => @event.Title == new IssueTitle("A better title"));
}
#endif

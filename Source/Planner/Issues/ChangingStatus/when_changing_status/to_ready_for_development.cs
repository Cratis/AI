// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.ChangingStatus.when_changing_status;

public class to_ready_for_development : Specification
{
    CommandScenario<ChangeIssueStatus> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ChangeIssueStatus("cratis-studio-256", IssueStatus.ReadyForDevelopment));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_marked_ready_for_development() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueMarkedReadyForDevelopment>();
}
#endif

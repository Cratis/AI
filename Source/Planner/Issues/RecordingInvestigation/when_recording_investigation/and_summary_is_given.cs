// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.RecordingInvestigation.when_recording_investigation;

public class and_summary_is_given : Specification
{
    CommandScenario<RecordInvestigation> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new RecordInvestigation("cratis-studio-256", "Implement by adding a slice", "sonnet"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_issue_investigated() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueInvestigated>(
        @event =>
            @event.Summary == new InvestigationSummary("Implement by adding a slice") &&
            @event.SuggestedModel == new ModelName("sonnet"));
}
#endif

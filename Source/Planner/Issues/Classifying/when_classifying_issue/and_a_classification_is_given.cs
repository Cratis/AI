// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Issues.Classifying.when_classifying_issue;

public class and_a_classification_is_given : Specification
{
    CommandScenario<ClassifyIssue> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ClassifyIssue(
        "cratis-studio-256",
        IssueKind.Bug,
        IssueFeasibility.AgentCanDo,
        Priority.High,
        [new LabelName("bug")],
        "Chronicle kernel",
        "sonnet"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_issue_classified() => _scenario.EventSequence.ShouldHaveAppendedEvent<IssueClassified>(
        @event =>
            @event.Kind == IssueKind.Bug &&
            @event.Feasibility == IssueFeasibility.AgentCanDo &&
            @event.SuggestedPriority == Priority.High &&
            @event.Area == new IssueArea("Chronicle kernel") &&
            @event.SuggestedModel == new ModelName("sonnet"));
}
#endif

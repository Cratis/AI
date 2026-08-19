// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Classifying;
using Planner.Issues.Registration;
using Planner.LanguageModels;

namespace Planner.Issues.Triaging.for_IssueTriage.when_issue_is_registered;

public class and_the_language_model_classifies_it : given.a_reactor
{
    void Establish() =>
        _languageModel.Complete(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(LanguageModelResult.Success(
            """
            { "kind": "bug", "feasibility": "agentCanDo", "priority": "high", "labels": ["bug"], "area": "Chronicle kernel", "model": "sonnet" }
            """));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(new IssueRegistered(
                "Cratis", "Studio", 256, "Something is broken", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.External, true, "It crashes", []));

    [Fact]
    async Task should_acknowledge_it_on_github() =>
        await _gitHub.Received(1).AddIssueComment(new OrganizationName("Cratis"), new RepositoryName("Studio"), new IssueNumber(256), Arg.Any<string>(), Arg.Any<CancellationToken>());

    [Fact]
    async Task should_record_the_classification() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ClassifyIssue>(command =>
            command.Issue == _issueId &&
            command.Kind == IssueKind.Bug &&
            command.Feasibility == IssueFeasibility.AgentCanDo));

    [Fact]
    async Task should_apply_the_suggested_labels_on_github() =>
        await _gitHub.Received(1).AddLabels(new OrganizationName("Cratis"), new RepositoryName("Studio"), new IssueNumber(256), Arg.Is<IEnumerable<LabelName>>(labels => labels.Single() == new LabelName("bug")), Arg.Any<CancellationToken>());
}
#endif

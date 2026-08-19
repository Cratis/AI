// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Classifying;
using Planner.Issues.Registration;
using Planner.LanguageModels;

namespace Planner.Issues.Triaging.for_IssueTriage.when_issue_is_registered;

public class and_no_language_model_is_configured : given.a_reactor
{
    void Establish() =>
        _languageModel.Complete(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Failure("No language model is configured"));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(new IssueRegistered(
                "Cratis", "Studio", 256, "Something is broken", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.External, true, "It crashes", []));

    [Fact]
    async Task should_still_acknowledge_it_on_github() =>
        await _gitHub.Received(1).AddIssueComment(new OrganizationName("Cratis"), new RepositoryName("Studio"), new IssueNumber(256), Arg.Any<string>(), Arg.Any<CancellationToken>());

    [Fact]
    async Task should_not_record_any_classification() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<ClassifyIssue>());
}
#endif

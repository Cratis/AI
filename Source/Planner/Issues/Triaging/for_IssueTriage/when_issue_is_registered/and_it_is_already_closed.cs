// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Registration;

namespace Planner.Issues.Triaging.for_IssueTriage.when_issue_is_registered;

public class and_it_is_already_closed : given.a_reactor
{
    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_issueId)
            .Events(new IssueRegistered(
                "Cratis", "Studio", 256, "An old, already-closed issue", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.External, false, "It crashed", []));

    [Fact]
    async Task should_not_acknowledge_it() =>
        await _gitHub.DidNotReceive().AddIssueComment(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<IssueNumber>(), Arg.Any<string>(), Arg.Any<CancellationToken>());

    [Fact]
    async Task should_not_ask_the_language_model() =>
        await _languageModel.DidNotReceive().Complete(Arg.Any<string>(), Arg.Any<CancellationToken>());
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Chronicle.Testing.Reactors;
using Microsoft.Extensions.DependencyInjection;
using Planner.Issues.ChangingStatus;
using Planner.Identity;

namespace Planner.Issues.AcceptingPullRequest.for_PostMergeBookkeeping.when_pull_request_is_merged;

public class and_it_was_merged : Specification
{
    static readonly IssueId _issueId = IssueId.From("Cratis", "Studio", 256);

    ICommandPipeline _commandPipeline;
    ReactorScenario<PostMergeBookkeeping> _scenario;

    void Establish()
    {
        _commandPipeline = Substitute.For<ICommandPipeline>();
        _scenario = new(services => services
            .AddSingleton(_commandPipeline)
            .AddSingleton(SystemExecutionScope.ForSpecs()));
    }

    async Task Because() =>
        await _scenario.Given.ForEventSource(_issueId).Events(new PullRequestMerged(42));

    [Fact]
    async Task should_clear_the_issue_status() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ChangeIssueStatus>(command =>
            command.Issue == _issueId && command.Status == IssueStatus.None));
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Issues.Registration;

namespace Planner.GitHub.Synchronization.for_IssueSynchronizer.when_synchronizing_a_repository;

public class and_a_new_open_issue_exists : given.all_dependencies
{
    static readonly OrganizationName _owner = "Cratis";
    static readonly RepositoryName _repository = "Studio";

    void Establish() =>
        _gitHub.GetIssues(_owner, _repository, Arg.Any<CancellationToken>()).Returns(
        [
            new GitHubIssue(1, "Something is broken", "Bug", "someuser", DateTimeOffset.UnixEpoch, AuthorAssociation.External, true, "It broke", [], [], 0)
        ]);

    async Task Because() => await _synchronizer.SynchronizeRepository(_owner, _repository);

    [Fact]
    async Task should_register_the_issue() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RegisterIssue>(command => command.Title == new IssueTitle("Something is broken")));

    // GitHubSynchronizerGrain and AddedRepositorySynchronization both trigger this with no HTTP
    // request behind them - proves the mirrored commands run inside the trusted system scope rather
    // than relying on (nonexistent) ambient authorization.
    [Fact] void should_synchronize_as_the_system() => _systemExecution.Received(1).AsSystem();
}
#endif

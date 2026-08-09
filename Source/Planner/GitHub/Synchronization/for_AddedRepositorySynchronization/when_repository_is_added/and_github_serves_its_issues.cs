// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Repositories.Adding;

namespace Planner.GitHub.Synchronization.for_AddedRepositorySynchronization.when_repository_is_added;

public class and_github_serves_its_issues : given.a_reactor
{
    async Task Because() =>
        await _scenario.Given.ForEventSource(RepositoryId.From("Cratis", "Studio"))
            .Events(new RepositoryAdded("Cratis", "Studio"));

    [Fact]
    async Task should_load_the_issues_of_the_repository() =>
        await _synchronizer.Received(1).SynchronizeRepository(
            new OrganizationName("Cratis"),
            new RepositoryName("Studio"),
            Arg.Any<CancellationToken>());

    [Fact]
    void should_record_that_the_issues_are_synchronized() =>
        _scenario.ShouldHaveProduced<RepositoryIssuesSynchronized>();
}
#endif

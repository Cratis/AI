// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub.App;
using Planner.Repositories.Adding;

namespace Planner.GitHub.Synchronization.for_AddedRepositorySynchronization.when_repository_is_added;

public class and_the_app_is_not_installed_on_the_account : given.a_reactor
{
    void Establish() =>
        _synchronizer.SynchronizeRepository(Arg.Any<OrganizationName>(), Arg.Any<RepositoryName>(), Arg.Any<CancellationToken>())
            .Returns(_ => throw new GitHubAppNotInstalled("Cratis"));

    async Task Because() =>
        await _scenario.Given.ForEventSource(RepositoryId.From("Cratis", "Studio"))
            .Events(new RepositoryAdded("Cratis", "Studio"));

    [Fact]
    void should_record_that_the_synchronization_failed() =>
        _scenario.ShouldHaveProduced<RepositoryIssueSynchronizationFailed>();

    [Fact]
    void should_say_the_app_is_not_installed() =>
        _scenario.ShouldHaveProduced<RepositoryIssueSynchronizationFailed>(
            @event => @event.Reason == new GitHubAppNotInstalled("Cratis").Message);

    [Fact]
    void should_not_record_a_success() => _scenario.ShouldNotHaveProduced<RepositoryIssuesSynchronized>();
}
#endif

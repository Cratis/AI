// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub;
using Planner.GitHub.App;
using Planner.Repositories.Adding;
using Planner.Repositories.Organizations;
using Planner.Repositories.Organizations.Adding;

namespace Planner.Repositories.Discovery.for_RepositoryDiscovery.when_organization_is_added;

public class and_no_github_app_is_configured : given.a_reactor
{
    void Establish() =>
        _gitHub.GetOrganizationRepositories(new OrganizationName("Cratis"), Arg.Any<CancellationToken>())
            .Returns<IEnumerable<GitHubRepository>>(_ => throw new GitHubAppNotConfigured());

    async Task Because() =>
        await _scenario.Given.ForEventSource(OrganizationId.From("Cratis")).Events(new OrganizationAdded("Cratis", OrganizationTrackingPolicy.All));

    [Fact]
    void should_record_that_the_discovery_failed() =>
        _scenario.ShouldHaveProduced<OrganizationRepositoryDiscoveryFailed>();

    [Fact]
    void should_say_the_app_is_not_configured() =>
        _scenario.ShouldHaveProduced<OrganizationRepositoryDiscoveryFailed>(
            @event => @event.Reason == new GitHubAppNotConfigured().Message);

    [Fact]
    async Task should_not_add_any_repository() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<AddRepository>());
}
#endif

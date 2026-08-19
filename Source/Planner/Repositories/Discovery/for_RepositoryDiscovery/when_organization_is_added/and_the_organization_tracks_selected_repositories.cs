// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub;
using Planner.Repositories.Adding;
using Planner.Repositories.Organizations;
using Planner.Repositories.Organizations.Adding;

namespace Planner.Repositories.Discovery.for_RepositoryDiscovery.when_organization_is_added;

public class and_the_organization_tracks_selected_repositories : given.a_reactor
{
    void Establish() =>
        _gitHub.GetOrganizationRepositories(new OrganizationName("Cratis"), Arg.Any<CancellationToken>())
            .Returns(
            [
                new GitHubRepository("Cratis", "Studio", true),
                new GitHubRepository("Cratis", "Chronicle", false)
            ]);

    async Task Because() =>
        await _scenario.Given.ForEventSource(OrganizationId.From("Cratis")).Events(new OrganizationAdded("Cratis", OrganizationTrackingPolicy.Selected));

    [Fact]
    async Task should_not_add_any_repository_automatically() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<AddRepository>());

    [Fact]
    void should_still_record_what_was_discovered() =>
        _scenario.ShouldHaveProduced<OrganizationRepositoriesDiscovered>(@event => @event.RepositoryNames.Count() == 2);
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Repositories.Discovery;
using Planner.Repositories.Organizations.Adding;

namespace Planner.Repositories.Organizations.Listing.for_Organization.when_projecting;

public class and_repositories_are_discovered : Specification
{
    static readonly OrganizationId _organizationId = OrganizationId.From("Cratis");

    ReadModelScenario<Organization> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_organizationId)
            .Events(
                new OrganizationAdded("Cratis", OrganizationTrackingPolicy.All),
                new OrganizationRepositoriesDiscovered(["Studio", "Chronicle", "Arc", "Fundamentals", "Components", "cli", "AI"]));

    [Fact] void should_hold_the_name() => _scenario.Instance.Name.ShouldEqual(new OrganizationName("Cratis"));
    [Fact] void should_be_discovered() => _scenario.Instance.DiscoveryStatus.ShouldEqual(RepositoryDiscoveryStatus.Discovered);
    [Fact] void should_hold_how_many_repositories_were_found() => _scenario.Instance.RepositoryCount.ShouldEqual(7);
    [Fact] void should_carry_no_failure() => _scenario.Instance.DiscoveryFailure.ShouldBeEmpty();
}
#endif

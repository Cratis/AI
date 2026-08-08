// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Repositories.Adding;

namespace Planner.Repositories.Listing.for_Repository.when_projecting;

public class and_repository_is_added : Specification
{
    static readonly RepositoryId _repositoryId = RepositoryId.From("Cratis", "Studio");

    ReadModelScenario<Repository> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_repositoryId)
            .Events(new RepositoryAdded("Cratis", "Studio"));

    [Fact] void should_hold_the_owner() => _scenario.Instance.Owner.ShouldEqual(new OrganizationName("Cratis"));
    [Fact] void should_hold_the_name() => _scenario.Instance.Name.ShouldEqual(new RepositoryName("Studio"));
    [Fact] void should_have_no_code_owner() => _scenario.Instance.CodeOwner.ShouldBeNull();
}
#endif

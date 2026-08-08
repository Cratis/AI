// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Repositories.Adding;
using Planner.Repositories.MappingCodeRepository;

namespace Planner.Repositories.Listing.for_Repository.when_projecting;

public class and_code_repository_is_mapped : Specification
{
    static readonly RepositoryId _repositoryId = RepositoryId.From("Cratis", "StudioIssues");

    ReadModelScenario<Repository> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_repositoryId)
            .Events(
                new RepositoryAdded("Cratis", "StudioIssues"),
                new CodeRepositoryMapped("Cratis", "Studio"));

    [Fact] void should_keep_the_owner() => _scenario.Instance.Owner.ShouldEqual(new OrganizationName("Cratis"));
    [Fact] void should_hold_the_code_owner() => _scenario.Instance.CodeOwner.ShouldEqual(new OrganizationName("Cratis"));
    [Fact] void should_hold_the_code_name() => _scenario.Instance.CodeName.ShouldEqual(new RepositoryName("Studio"));
}
#endif

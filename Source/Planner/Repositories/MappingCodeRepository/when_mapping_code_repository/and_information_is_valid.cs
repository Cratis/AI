// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Repositories.MappingCodeRepository.when_mapping_code_repository;

public class and_information_is_valid : Specification
{
    CommandScenario<MapCodeRepository> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new MapCodeRepository("cratis-studioissues", "Cratis", "Studio"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_code_repository_mapped() => _scenario.EventSequence.ShouldHaveAppendedEvent<CodeRepositoryMapped>(
        @event =>
            @event.CodeOwner == new OrganizationName("Cratis") &&
            @event.CodeName == new RepositoryName("Studio"));
}
#endif

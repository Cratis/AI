// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Repositories.Adding.when_adding_repository;

public class and_information_is_valid : Specification
{
    CommandScenario<AddRepository> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new AddRepository("Cratis", "Studio"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_repository_added() => _scenario.EventSequence.ShouldHaveAppendedEvent<RepositoryAdded>(
        @event =>
            @event.Owner == new OrganizationName("Cratis") &&
            @event.Name == new RepositoryName("Studio"));
}
#endif

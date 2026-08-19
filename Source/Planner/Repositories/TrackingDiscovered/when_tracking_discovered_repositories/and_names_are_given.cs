// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Repositories.Adding;

namespace Planner.Repositories.TrackingDiscovered.when_tracking_discovered_repositories;

public class and_names_are_given : Specification
{
    CommandScenario<TrackDiscoveredRepositories> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new TrackDiscoveredRepositories(
        "Cratis", [new RepositoryName("Studio"), new RepositoryName("Chronicle")]));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_add_the_first_repository() => _scenario.EventSequence.ShouldHaveAppendedEvent<RepositoryAdded>(
        @event => @event.Name == new RepositoryName("Studio"));

    [Fact]
    void should_add_the_second_repository() => _scenario.EventSequence.ShouldHaveAppendedEvent<RepositoryAdded>(
        @event => @event.Name == new RepositoryName("Chronicle"));
}
#endif

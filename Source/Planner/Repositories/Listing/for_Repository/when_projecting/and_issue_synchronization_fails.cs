// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.GitHub.Synchronization;
using Planner.Repositories.Adding;

namespace Planner.Repositories.Listing.for_Repository.when_projecting;

public class and_issue_synchronization_fails : Specification
{
    static readonly RepositoryId _repositoryId = RepositoryId.From("Cratis", "Studio");

    ReadModelScenario<Repository> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_repositoryId)
            .Events(
                new RepositoryAdded("Cratis", "Studio"),
                new RepositoryIssueSynchronizationFailed("The GitHub App is not installed on 'Cratis'."));

    [Fact]
    void should_be_failed() => _scenario.Instance.SynchronizationStatus.ShouldEqual(IssueSynchronizationStatus.Failed);

    [Fact]
    void should_carry_the_reason() =>
        _scenario.Instance.SynchronizationFailure.ShouldEqual("The GitHub App is not installed on 'Cratis'.");
}
#endif

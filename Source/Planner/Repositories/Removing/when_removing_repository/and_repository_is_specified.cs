// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Repositories.Removing.when_removing_repository;

public class and_repository_is_specified : Specification
{
    CommandScenario<RemoveRepository> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new RemoveRepository("cratis-studio"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] void should_append_repository_removed() => _scenario.EventSequence.ShouldHaveAppendedEvent<RepositoryRemoved>();
}
#endif

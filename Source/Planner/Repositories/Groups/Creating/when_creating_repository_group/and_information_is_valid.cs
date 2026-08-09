// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Repositories.Groups.Creating.when_creating_repository_group;

public class and_information_is_valid : Specification
{
    CommandScenario<CreateRepositoryGroup> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(
        new CreateRepositoryGroup("Frameworks", [new RepositoryId("cratis-fundamentals"), new RepositoryId("cratis-chronicle")]));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_repository_group_created() => _scenario.EventSequence.ShouldHaveAppendedEvent<RepositoryGroupCreated>(
        @event =>
            @event.Name == new RepositoryGroupName("Frameworks") &&
            @event.Repositories.Count() == 2);
}
#endif

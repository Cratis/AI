// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Repositories.Organizations.Adding.when_adding_organization;

public class and_name_is_valid : Specification
{
    CommandScenario<AddOrganization> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new AddOrganization("Cratis"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_organization_added() => _scenario.EventSequence.ShouldHaveAppendedEvent<OrganizationAdded>(
        @event => @event.Name == new OrganizationName("Cratis"));
}
#endif

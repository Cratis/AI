// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedTeamMembers.for_SetAIProviderAllowedTeamMembers;

public class when_no_authority_is_configured : Specification
{
    Exception _error;
    AIProviderAllowedTeamMembersSet _event;

    async Task Because() => _error = await Catch.Exception(async () => _event = await
        new SetAIProviderAllowedTeamMembers(AIProviderId.New(), [(TeamMemberId)"alice"])
            .Handle(new DenyProviderSelectionAuthority()));

    [Fact] void should_reject_the_change() => _error.ShouldBeOfExactType<AIProviderSelectionNotAuthorized>();
    [Fact] void should_retain_unauthorized_access_handling() => (_error is UnauthorizedAccessException).ShouldBeTrue();
    [Fact] void should_explain_the_denial() => _error.Message.ShouldEqual("Not authorized to change provider selection");
    [Fact] void should_not_produce_an_event() => _event.ShouldBeNull();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedTeamMembers.for_SetAIProviderAllowedTeamMembersValidator.when_validating;

public class and_no_authority_is_configured : Specification
{
    FluentValidation.Results.ValidationResult _result;

    async Task Because() => _result = await new SetAIProviderAllowedTeamMembersValidator(new DenyProviderSelectionAuthority())
        .ValidateAsync(new SetAIProviderAllowedTeamMembers(AIProviderId.New(), [(TeamMemberId)"alice"]));

    [Fact] void should_deny_replacing_the_selection() => _result.IsValid.ShouldBeFalse();
}

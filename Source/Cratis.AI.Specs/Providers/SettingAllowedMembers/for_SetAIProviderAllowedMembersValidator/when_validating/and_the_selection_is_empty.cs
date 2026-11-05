// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedMembers.for_SetAIProviderAllowedMembersValidator.when_validating;

public class and_the_selection_is_empty : Specification
{
    FluentValidation.Results.ValidationResult _result;
    SetAIProviderAllowedMembersValidator _validator;

    void Establish() => _validator = new();

    async Task Because() => _result = await _validator.ValidateAsync(new SetAIProviderAllowedMembers(AIProviderId.New(), []));

    [Fact] void should_allow_disabling_the_provider_for_everyone() => _result.IsValid.ShouldBeTrue();
}

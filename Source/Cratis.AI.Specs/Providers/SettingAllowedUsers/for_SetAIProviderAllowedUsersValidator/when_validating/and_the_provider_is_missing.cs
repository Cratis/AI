// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.SettingAllowedUsers.for_SetAIProviderAllowedUsersValidator.when_validating;

public class and_the_provider_is_missing : Specification
{
    FluentValidation.Results.ValidationResult _result;
    SetAIProviderAllowedUsersValidator _validator;

    void Establish() => _validator = new(Substitute.For<IReadModels>());

    async Task Because() => _result = await _validator.ValidateAsync(new SetAIProviderAllowedUsers(AIProviderId.New(), ["alice"]));

    [Fact] void should_reject_the_selection() => _result.IsValid.ShouldBeFalse();
}

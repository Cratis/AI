// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedTeamMembers.for_SetAIProviderAllowedTeamMembersValidator.when_validating;

public class and_the_provider_does_not_exist : Specification
{
    SetAIProviderAllowedTeamMembersValidator _validator;
    FluentValidation.Results.ValidationResult _result;

    void Establish()
    {
        var authority = Substitute.For<IProviderSelectionAuthority>();
        authority.CanSet(Arg.Any<AIProviderId>()).Returns(true);
        _validator = new(authority, Substitute.For<Cratis.Chronicle.ReadModels.IReadModels>());
    }

    async Task Because() => _result = await _validator.ValidateAsync(new SetAIProviderAllowedTeamMembers(AIProviderId.New(), []));

    [Fact] void should_reject_the_selection() => _result.IsValid.ShouldBeFalse();
    [Fact] void should_identify_the_provider() => _result.Errors.ShouldContain(error => error.ErrorMessage == "Provider must exist");
}

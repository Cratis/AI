// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedTeamMembers.for_SetAIProviderAllowedTeamMembersValidator.when_validating;

public class and_the_selection_is_valid : Specification
{
    FluentValidation.Results.ValidationResult _result;
    SetAIProviderAllowedTeamMembersValidator _validator;

    void Establish()
    {
        var authority = Substitute.For<IProviderSelectionAuthority>();
        authority.CanSet(Arg.Any<AIProviderId>()).Returns(true);
        var readModels = Substitute.For<Cratis.Chronicle.ReadModels.IReadModels>();
        readModels.GetInstanceById<ConfiguredAIProvider>(Arg.Any<Cratis.Chronicle.ReadModels.ReadModelKey>())
            .Returns(new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.OpenAI, "test"));
        _validator = new(authority, readModels);
    }

    async Task Because() => _result = await _validator.ValidateAsync(new SetAIProviderAllowedTeamMembers(AIProviderId.New(), [(TeamMemberId)"alice"]));

    [Fact] void should_accept_the_selection() => _result.IsValid.ShouldBeTrue();
}

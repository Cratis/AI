// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedTeamMembers.for_SetAIProviderAllowedTeamMembersValidator.when_validating;

public class and_team_members_are_repeated : Specification
{
    FluentValidation.Results.ValidationResult _result;
    SetAIProviderAllowedTeamMembersValidator _validator;

    void Establish() => _validator = new();

    async Task Because() => _result = await _validator.ValidateAsync(new SetAIProviderAllowedTeamMembers(AIProviderId.New(), [(TeamMemberId)"alice", (TeamMemberId)"alice"]));

    [Fact] void should_reject_duplicates() => _result.IsValid.ShouldBeFalse();
}

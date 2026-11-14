// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedTeamMembers.for_SetAIProviderAllowedTeamMembers;

public class when_setting_allowed_team_members : Specification
{
    AIProviderAllowedTeamMembersSet _result;

    async Task Because()
    {
        var authority = Substitute.For<IProviderSelectionAuthority>();
        authority.CanSet(Arg.Any<AIProviderId>()).Returns(true);
        _result = await new SetAIProviderAllowedTeamMembers(AIProviderId.New(), [(TeamMemberId)"alice", (TeamMemberId)"bob"]).Handle(authority);
    }

    [Fact] void should_record_the_whole_selection() => _result.AllowedTeamMembers.ShouldContainOnly((TeamMemberId)"alice", (TeamMemberId)"bob");
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedMembers.for_SetAIProviderAllowedMembers;

public class when_setting_allowed_members : Specification
{
    AIProviderAllowedMembersSet _result;

    void Because() => _result = new SetAIProviderAllowedMembers(AIProviderId.New(), [(TeamMemberId)"alice", (TeamMemberId)"bob"]).Handle();

    [Fact] void should_record_the_whole_selection() => _result.AllowedMembers.ShouldContainOnly((TeamMemberId)"alice", (TeamMemberId)"bob");
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.SettingAllowedUsers.for_SetAIProviderAllowedUsers;

public class when_setting_allowed_users : Specification
{
    AIProviderAllowedUsersSet _result;

    void Because() => _result = new SetAIProviderAllowedUsers(AIProviderId.New(), ["alice", "bob"]).Handle();

    [Fact] void should_record_the_whole_selection() => _result.AllowedUserIds.ShouldContainOnly((AIProviderAllowedUserId)"alice", (AIProviderAllowedUserId)"bob");
}

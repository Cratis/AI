// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_AIProviderMemberAccess.when_checking;

public class and_the_initiator_is_unknown : Specification
{
    bool _allowed;

    void Because() => _allowed = AIProviderMemberAccess.IsAllowedFor(
        new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.OpenAI, new AIProviderApiKey("test"))
        {
            HasAllowedTeamMembersSelection = true,
            AllowedTeamMembers = [TeamMemberId.NotSet]
        }, TeamMemberId.NotSet);

    [Fact] void should_deny_even_when_the_sentinel_is_selected() => _allowed.ShouldBeFalse();
}

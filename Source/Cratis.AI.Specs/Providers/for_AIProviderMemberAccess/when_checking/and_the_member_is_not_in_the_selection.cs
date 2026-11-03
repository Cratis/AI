// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_AIProviderMemberAccess.when_checking;

public class and_the_member_is_not_in_the_selection : Specification
{
    ConfiguredAIProvider _provider;
    bool _result;

    void Establish() => _provider = new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-key")
    {
        HasAllowedMembersSelection = true,
        AllowedMembers = [(TeamMemberId)"bob"]
    };

    void Because() => _result = AIProviderMemberAccess.IsAllowedFor(_provider, (TeamMemberId)"alice");

    [Fact] void should_disallow_the_member() => _result.ShouldBeFalse();
}

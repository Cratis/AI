// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_AIProviderMemberAccess.when_checking;

public class and_no_selection_has_been_made : Specification
{
    ConfiguredAIProvider _provider;
    bool _result;

    void Establish() => _provider = new(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-key");

    void Because() => _result = AIProviderMemberAccess.IsAllowedFor(_provider, (TeamMemberId)"alice");

    [Fact] void should_allow_every_member() => _result.ShouldBeTrue();
}

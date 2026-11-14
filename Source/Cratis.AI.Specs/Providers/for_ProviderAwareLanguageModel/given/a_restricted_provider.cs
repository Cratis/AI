// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Agents.Listing;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.given;

public class a_restricted_provider : all_dependencies
{
    protected AIProviderId _provider;
    protected ConfiguredAIProvider _restricted;

    void Establish()
    {
        _provider = AIProviderId.New();
        AgentIs(new(AgentId.For((LanguageModelPurpose)Purpose), (LanguageModelPurpose)Purpose, "Assistant", "Assists.", ModelTier.Balanced, _provider, null));
        _restricted = new(_provider, AIProviderType.Anthropic, "test")
        {
            HasAllowedTeamMembersSelection = true,
            AllowedTeamMembers = [(TeamMemberId)"alice"]
        };
        ProviderIs(_provider, _restricted);
    }
}

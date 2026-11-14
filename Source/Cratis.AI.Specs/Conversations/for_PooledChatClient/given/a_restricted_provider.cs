// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_PooledChatClient.given;

public class a_restricted_provider : a_pooled_chat_client
{
    protected AIProviderId _provider;
    protected ConfiguredAIProvider _restricted;

    void Establish()
    {
        _provider = AIProviderId.New();
        AgentNamesProvider(_provider);
        ProviderIs(_provider, AIProviderType.Anthropic);
        _restricted = new(_provider, AIProviderType.Anthropic, "test")
        {
            AvailableModels = PublishedCatalogs.For(AIProviderType.Anthropic),
            HasAllowedTeamMembersSelection = true,
            AllowedTeamMembers = [(TeamMemberId)"alice"]
        };
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_provider).Returns(_restricted);
    }
}

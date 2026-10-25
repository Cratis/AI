// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Conversations.for_PooledChatClient.given;

public class a_subscription_without_a_catalog : a_pooled_chat_client
{
    protected static readonly AIProviderId Subscription = AIProviderId.New();

    void Establish()
    {
        var pool = AIProviderPoolId.New();
        AgentDrawsFromPool(pool);
        PoolIs(pool, Subscription);
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)Subscription)
            .Returns(new ConfiguredAIProvider(Subscription, AIProviderType.Anthropic, "sk-ant-oat01-test"));
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_creating_a_client;

public class and_the_provider_has_no_conversational_client : Specification
{
    (Microsoft.Extensions.AI.IChatClient Client, string ModelId)? _result;

    void Because() => _result = AIChatClientFactory.Create(AIProviderType.ZAI, null, null, string.Empty);

    [Fact] void should_return_nothing() => _result.ShouldBeNull();
}

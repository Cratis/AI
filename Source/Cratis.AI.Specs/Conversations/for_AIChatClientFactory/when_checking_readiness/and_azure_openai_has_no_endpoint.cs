// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_checking_readiness;

public class and_azure_openai_has_no_endpoint : Specification
{
    bool _result;

    void Because() => _result = AIChatClientFactory.CanServe(AIProviderType.AzureOpenAI, new AIProviderApiKey("key"), null, new ModelName("gpt-4o-deployment"));

    [Fact] void should_not_be_able_to_serve() => _result.ShouldBeFalse();
}

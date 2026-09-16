// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_resolving_a_model_id;

public class and_nothing_names_one : Specification
{
    string _openAI;
    string _anthropic;
    string _azureOpenAI;
    string _openAICompatible;

    void Because()
    {
        _openAI = AIChatClientFactory.ResolveModelId(AIProviderType.OpenAI, null);
        _anthropic = AIChatClientFactory.ResolveModelId(AIProviderType.Anthropic, null);
        _azureOpenAI = AIChatClientFactory.ResolveModelId(AIProviderType.AzureOpenAI, null);
        _openAICompatible = AIChatClientFactory.ResolveModelId(AIProviderType.OpenAICompatible, null);
    }

    [Fact] void should_default_openai() => _openAI.ShouldEqual(AIChatClientFactory.DefaultOpenAIModelId);
    [Fact] void should_default_anthropic() => _anthropic.ShouldEqual(AIChatClientFactory.DefaultAnthropicModelId);
    [Fact] void should_have_no_default_for_azure_openai() => _azureOpenAI.ShouldBeEmpty();
    [Fact] void should_have_no_default_for_openai_compatible() => _openAICompatible.ShouldBeEmpty();
}

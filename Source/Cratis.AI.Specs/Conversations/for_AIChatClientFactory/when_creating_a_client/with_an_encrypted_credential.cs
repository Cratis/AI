// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Conversations.for_AIChatClientFactory.when_creating_a_client;

public class with_an_encrypted_credential : Specification
{
    Exception?[] _errors = [];

    void Because() => _errors = [.. new[] { AIProviderType.Anthropic, AIProviderType.OpenAI, AIProviderType.AzureOpenAI, AIProviderType.OpenAICompatible }
        .Select(type => Catch.Exception(() => AIChatClientFactory.Create(type, "enc:v1:secret", "https://example.test", "model")))];

    [Fact] void should_require_reconfiguration_before_creating_any_vendor_client() => _errors.All(error => error is AIProviderRequiresReconfiguration).ShouldBeTrue();
}

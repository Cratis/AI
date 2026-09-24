// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Monads;

namespace Cratis.AI.Providers.Reconfiguring.for_ReconfigureAzureOpenAIProvider.when_handling;

public class and_the_endpoint_and_key_both_change : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    static readonly AIProviderEndpoint _newEndpoint = new("https://new-resource.openai.azure.com");
    static readonly AIProviderApiKey _newApiKey = new("new-key");

    ConfiguredAIProvider _current;
    Result<AzureOpenAIProviderReconfigured, Cratis.Arc.Validation.ValidationResult> _result;

    void Establish()
    {
        _current = new ConfiguredAIProvider(
            _providerId, AIProviderType.AzureOpenAI, new AIProviderApiKey("old"), new AIProviderEndpoint("https://old-resource.openai.azure.com"));
    }

    void Because() => _result = new ReconfigureAzureOpenAIProvider(_providerId, _newEndpoint, _newApiKey).Handle(_current);

    [Fact]
    void should_carry_the_new_endpoint()
    {
        _result.TryGetResult(out var evt);
        evt.Endpoint.ShouldEqual(_newEndpoint);
    }

    [Fact]
    void should_protect_the_new_key()
    {
        _result.TryGetResult(out var evt);
        evt.ApiKey.Value.ShouldEqual(_newApiKey.Value);
    }
}

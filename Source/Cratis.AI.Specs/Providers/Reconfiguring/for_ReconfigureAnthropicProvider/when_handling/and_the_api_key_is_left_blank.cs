// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Monads;

namespace Cratis.AI.Providers.Reconfiguring.for_ReconfigureAnthropicProvider.when_handling;

/// <summary>
/// A blank API key keeps whatever is already recorded, rather than clearing it or re-protecting an
/// empty value - the same idiom every vendor's Reconfigure command follows.
/// </summary>
public class and_the_api_key_is_left_blank : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    static readonly AIProviderApiKey _existingApiKey = new("sk-ant-existing");

    ConfiguredAIProvider _current;
    Result<AnthropicProviderReconfigured, Cratis.Arc.Validation.ValidationResult> _result;

    void Establish()
    {
        _current = new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, _existingApiKey);
    }

    void Because() => _result = new ReconfigureAnthropicProvider(_providerId, AIProviderApiKey.NotSet).Handle(_current);

    [Fact]
    void should_keep_the_existing_key()
    {
        _result.TryGetResult(out var evt);
        evt.ApiKey.ShouldEqual(_existingApiKey);
    }
}

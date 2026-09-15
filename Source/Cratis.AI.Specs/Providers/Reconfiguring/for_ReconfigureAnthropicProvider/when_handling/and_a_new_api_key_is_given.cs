// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Monads;
using NSubstitute;

namespace Cratis.AI.Providers.Reconfiguring.for_ReconfigureAnthropicProvider.when_handling;

public class and_a_new_api_key_is_given : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    static readonly AIProviderApiKey _newApiKey = new("sk-ant-new");

    ISecretProtector _protector;
    ConfiguredAIProvider _current;
    Result<AnthropicProviderReconfigured, Cratis.Arc.Validation.ValidationResult> _result;

    void Establish()
    {
        _protector = Substitute.For<ISecretProtector>();
        _protector.Protect(_newApiKey.Value).Returns("protected:" + _newApiKey.Value);
        _current = new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, new AIProviderApiKey("protected:old"));
    }

    async Task Because() => _result = await new ReconfigureAnthropicProvider(_providerId, _newApiKey).Handle(_current, _protector);

    [Fact] void should_succeed() => _result.IsSuccess.ShouldBeTrue();

    [Fact]
    void should_protect_the_new_key()
    {
        _result.TryGetResult(out var evt);
        evt.ApiKey.Value.ShouldEqual("protected:" + _newApiKey.Value);
    }
}

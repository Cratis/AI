// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Monads;
using NSubstitute;

namespace Cratis.AI.Providers.Configuring.for_ReconfigureAnthropicProvider.when_handling;

public class and_the_api_key_is_left_blank : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();
    static readonly AIProviderApiKey _existingApiKey = new("protected:existing");

    ISecretProtector _protector;
    ConfiguredAIProvider _current;
    Result<AnthropicModelConfigured, Cratis.Arc.Validation.ValidationResult> _result;

    void Establish()
    {
        _protector = Substitute.For<ISecretProtector>();
        _current = new ConfiguredAIProvider(_providerId, AIProviderType.Anthropic, _existingApiKey);
    }

    async Task Because() =>
        _result = await new ReconfigureAnthropicProvider(_providerId, new AIProviderName("Renamed"), AIProviderApiKey.NotSet).Handle(_current, _protector);

    [Fact]
    void should_keep_the_existing_key()
    {
        _result.TryGetResult(out var evt);
        evt.ApiKey.ShouldEqual(_existingApiKey);
    }

    [Fact] void should_never_call_the_protector() => _protector.DidNotReceiveWithAnyArgs().Protect(default!);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Monads;
using NSubstitute;

namespace Cratis.AI.Providers.Reconfiguring.for_ReconfigureAnthropicProvider.when_handling;

public class and_the_provider_is_not_configured : Specification
{
    Result<AnthropicProviderReconfigured, Cratis.Arc.Validation.ValidationResult> _result;

    async Task Because() =>
        _result = await new ReconfigureAnthropicProvider(AIProviderId.New(), new AIProviderApiKey("sk-ant-new")).Handle(null, Substitute.For<ISecretProtector>());

    [Fact] void should_not_succeed() => _result.IsSuccess.ShouldBeFalse();

    [Fact]
    void should_say_the_provider_is_not_configured()
    {
        _result.TryGetError(out var error);
        error.Message.ShouldContain("not configured");
    }
}

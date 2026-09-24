// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Monads;

namespace Cratis.AI.Providers.UsageReporting.SettingCredential.for_SetAIProviderUsageCredential;

public class when_handling : Specification
{
    static readonly AIProviderId _id = AIProviderId.New();
    static readonly AIProviderApiKey _usageApiKey = new("sk-ant-admin01-test");

    ConfiguredAIProvider _current;
    Result<AIProviderUsageCredentialSet, Cratis.Arc.Validation.ValidationResult> _result;

    void Establish()
    {
        _current = new(_id, AIProviderType.Anthropic, "completions-key");
    }

    void Because() => _result = new SetAIProviderUsageCredential(_id, _usageApiKey).Handle(_current);

    [Fact] void should_succeed() => _result.IsSuccess.ShouldBeTrue();

    [Fact]
    void should_protect_the_usage_key()
    {
        _result.TryGetResult(out var @event);
        @event.UsageApiKey.Value.ShouldEqual(_usageApiKey.Value);
    }
}

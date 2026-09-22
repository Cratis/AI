// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Monads;
using NSubstitute;

namespace Cratis.AI.Providers.UsageReporting.SettingCredential.for_SetAIProviderUsageCredential;

public class when_handling : Specification
{
    static readonly AIProviderId _id = AIProviderId.New();
    static readonly AIProviderApiKey _usageApiKey = new("sk-ant-admin01-test");

    ISecretProtector _protector;
    ConfiguredAIProvider _current;
    Result<AIProviderUsageCredentialSet, Cratis.Arc.Validation.ValidationResult> _result;

    void Establish()
    {
        _protector = Substitute.For<ISecretProtector>();
        _protector.Protect(_usageApiKey.Value).Returns("protected:" + _usageApiKey.Value);
        _current = new(_id, AIProviderType.Anthropic, "completions-key");
    }

    async Task Because() => _result = await new SetAIProviderUsageCredential(_id, _usageApiKey).Handle(_current, _protector);

    [Fact] void should_succeed() => _result.IsSuccess.ShouldBeTrue();

    [Fact]
    void should_protect_the_usage_key()
    {
        _result.TryGetResult(out var @event);
        @event.UsageApiKey.Value.ShouldEqual("protected:" + _usageApiKey.Value);
    }
}

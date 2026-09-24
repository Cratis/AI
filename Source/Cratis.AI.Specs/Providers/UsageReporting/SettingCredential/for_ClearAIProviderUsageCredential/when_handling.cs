// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Monads;

namespace Cratis.AI.Providers.UsageReporting.SettingCredential.for_ClearAIProviderUsageCredential;

public class when_handling : Specification
{
    static readonly AIProviderId _id = AIProviderId.New();

    ConfiguredAIProvider? _current;
    Result<AIProviderUsageCredentialCleared, Cratis.Arc.Validation.ValidationResult> _result;

    void Establish() => _current = new(_id, AIProviderType.Anthropic, "completions-key") { UsageApiKey = "sk-ant-admin01-test" };

    Task Because()
    {
        _result = new ClearAIProviderUsageCredential(_id).Handle(_current);
        return Task.CompletedTask;
    }

    [Fact] void should_succeed() => _result.IsSuccess.ShouldBeTrue();
}

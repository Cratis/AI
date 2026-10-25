// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_ProviderServing.when_checking_a_subscription;

public class with_an_active_cooldown : Specification
{
    bool _serves;

    void Because()
    {
        var now = DateTimeOffset.UtcNow;
        _serves = new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.Anthropic, "sk-ant-oat-test")
        {
            RateLimitedUntil = now.AddHours(1)
        }.CanServe(now);
    }

    [Fact] void should_not_bypass_rate_limits_with_alias_defaults() => _serves.ShouldBeFalse();
}

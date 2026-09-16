// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Providers.Pools.for_AIProviderQuotaStatus.when_checking_exhaustion;

public class and_remaining_tokens_is_zero_but_the_reset_time_has_passed : Specification
{
    [Fact]
    void should_not_be_exhausted()
    {
        var timeProvider = Substitute.For<TimeProvider>();
        timeProvider.GetUtcNow().Returns(DateTimeOffset.Parse("2026-01-01T00:05:00Z"));

        new AIProviderQuotaStatus(RemainingRequests: null, RemainingTokens: 0, ResetsAt: DateTimeOffset.Parse("2026-01-01T00:00:00Z"))
            .IsExhausted(timeProvider)
            .ShouldBeFalse();
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_AIProviderQuotaStatus.when_checking_exhaustion;

public class and_remaining_requests_is_zero_with_no_reset_reported : Specification
{
    [Fact]
    void should_be_exhausted() =>
        new AIProviderQuotaStatus(RemainingRequests: 0, RemainingTokens: null, ResetsAt: null)
            .IsExhausted(TimeProvider.System)
            .ShouldBeTrue();
}

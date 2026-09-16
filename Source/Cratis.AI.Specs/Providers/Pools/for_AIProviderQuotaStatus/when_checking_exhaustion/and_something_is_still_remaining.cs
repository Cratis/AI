// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_AIProviderQuotaStatus.when_checking_exhaustion;

public class and_something_is_still_remaining : Specification
{
    [Fact]
    void should_not_be_exhausted() =>
        new AIProviderQuotaStatus(RemainingRequests: 10, RemainingTokens: 500, ResetsAt: null)
            .IsExhausted(TimeProvider.System)
            .ShouldBeFalse();
}

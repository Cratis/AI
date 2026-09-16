// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_AIProviderQuotaTracker;

public class when_nothing_has_been_reported : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();

    AIProviderQuotaTracker _tracker;

    void Establish() => _tracker = new AIProviderQuotaTracker(TimeProvider.System);

    [Fact] void should_have_no_known_quota() => _tracker.KnownQuotaFor(_providerId).ShouldBeNull();
    [Fact] void should_not_be_known_exhausted() => _tracker.IsKnownExhausted(_providerId).ShouldBeFalse();
}

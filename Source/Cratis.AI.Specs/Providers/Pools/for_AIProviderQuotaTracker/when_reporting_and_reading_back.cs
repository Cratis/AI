// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.Pools.for_AIProviderQuotaTracker;

public class when_reporting_and_reading_back : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();

    AIProviderQuotaTracker _tracker;

    void Establish() => _tracker = new AIProviderQuotaTracker(TimeProvider.System);

    void Because()
    {
        using var response = new HttpResponseMessage(HttpStatusCode.OK);
        response.Headers.Add("anthropic-ratelimit-requests-remaining", "42");
        _tracker.Report(_providerId, AIProviderType.Anthropic, response);
    }

    [Fact] void should_have_a_known_quota() => _tracker.KnownQuotaFor(_providerId).ShouldNotBeNull();
    [Fact] void should_read_back_the_reported_remaining_requests() => _tracker.KnownQuotaFor(_providerId)!.RemainingRequests.ShouldEqual(42L);
    [Fact] void should_not_be_known_exhausted_yet() => _tracker.IsKnownExhausted(_providerId).ShouldBeFalse();
}

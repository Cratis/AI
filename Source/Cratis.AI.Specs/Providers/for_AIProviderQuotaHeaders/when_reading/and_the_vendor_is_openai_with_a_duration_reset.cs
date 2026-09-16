// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Providers.for_AIProviderQuotaHeaders.when_reading;

public class and_the_vendor_is_openai_with_a_duration_reset : Specification
{
    AIProviderQuotaStatus? _status;

    void Because()
    {
        using var response = new HttpResponseMessage(HttpStatusCode.OK);
        response.Headers.Add("x-ratelimit-remaining-requests", "2999");
        response.Headers.Add("x-ratelimit-remaining-tokens", "149000");
        response.Headers.Add("x-ratelimit-reset-requests", "6m0s");
        response.Headers.Add("x-ratelimit-reset-tokens", "1s");
        _status = AIProviderQuotaHeaders.Read(AIProviderType.OpenAI, response);
    }

    [Fact] void should_read_a_status() => _status.ShouldNotBeNull();
    [Fact] void should_read_remaining_requests() => _status!.RemainingRequests.ShouldEqual(2999L);
    [Fact] void should_read_remaining_tokens() => _status!.RemainingTokens.ShouldEqual(149000L);

    [Fact]
    void should_reset_at_the_tighter_of_the_two_windows() =>
        (_status!.ResetsAt! <= DateTimeOffset.UtcNow.AddSeconds(2)).ShouldBeTrue();
}

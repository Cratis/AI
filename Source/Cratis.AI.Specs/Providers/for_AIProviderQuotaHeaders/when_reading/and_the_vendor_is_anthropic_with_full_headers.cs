// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.Providers.Pools;

namespace Cratis.AI.Providers.for_AIProviderQuotaHeaders.when_reading;

public class and_the_vendor_is_anthropic_with_full_headers : Specification
{
    AIProviderQuotaStatus? _status;

    void Because()
    {
        using var response = new HttpResponseMessage(HttpStatusCode.OK);
        response.Headers.Add("anthropic-ratelimit-requests-remaining", "48");
        response.Headers.Add("anthropic-ratelimit-input-tokens-remaining", "9000");
        response.Headers.Add("anthropic-ratelimit-output-tokens-remaining", "500");
        response.Headers.Add("anthropic-ratelimit-requests-reset", "2026-01-01T00:05:00Z");
        _status = AIProviderQuotaHeaders.Read(AIProviderType.Anthropic, response);
    }

    [Fact] void should_read_a_status() => _status.ShouldNotBeNull();
    [Fact] void should_read_remaining_requests() => _status!.RemainingRequests.ShouldEqual(48L);
    [Fact] void should_keep_the_lower_of_input_and_output_remaining_tokens() => _status!.RemainingTokens.ShouldEqual(500L);
    [Fact] void should_read_the_reset_timestamp() => _status!.ResetsAt.ShouldEqual(DateTimeOffset.Parse("2026-01-01T00:05:00Z"));
}

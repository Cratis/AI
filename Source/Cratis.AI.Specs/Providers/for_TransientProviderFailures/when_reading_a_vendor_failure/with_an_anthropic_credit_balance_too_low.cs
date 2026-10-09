// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

/// <summary>
/// An empty credit balance arrives as a 400, which would otherwise read as a rejected request that
/// stops the pool - it is a spent quota another provider can work around.
/// </summary>
public class with_an_anthropic_credit_balance_too_low : given.a_vendor_response
{
    void Establish()
    {
        _response.StatusCode = HttpStatusCode.BadRequest;
        _response.Content = new StringContent("""{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}""");
    }

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.Anthropic, "claude-sonnet-4", _providerId);

    [Fact] void should_be_quota_exhausted() => _failure.Result.IsQuotaExhausted.ShouldBeTrue();
    [Fact] void should_not_be_transient() => _failure.Result.IsTransient.ShouldBeFalse();
}

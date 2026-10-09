// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

/// <summary>
/// A per-minute rate limit is throttling: it stays a transient failure honoring Retry-After, exactly
/// as before quota exhaustion was told apart from it.
/// </summary>
public class with_ordinary_throttling : given.a_vendor_response
{
    void Establish()
    {
        _response.Content = new StringContent("""{"type":"error","error":{"type":"rate_limit_error","message":"Number of request tokens has exceeded your per-minute rate limit"}}""");
        _response.Headers.TryAddWithoutValidation("Retry-After", "3");
    }

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.Anthropic, "claude-sonnet-4", _providerId);

    [Fact] void should_be_transient() => _failure.Result.IsTransient.ShouldBeTrue();
    [Fact] void should_not_be_quota_exhausted() => _failure.Result.IsQuotaExhausted.ShouldBeFalse();
    [Fact] void should_honor_the_retry_wait() => _failure.Result.RetryAfter.ShouldEqual(TimeSpan.FromSeconds(3));
    [Fact] void should_not_say_the_quota_is_exhausted() => _failure.Result.FailureReason.ShouldNotContain("quota exhausted");
}

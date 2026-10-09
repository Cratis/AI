// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

/// <summary>
/// An enforced spend limit arrives as a 429, but it is a spent quota rather than throttling: retrying
/// the same provider after Retry-After cannot help, so it is classified for a pool to fail over on
/// instead (Cratis/AI#423).
/// </summary>
public class with_an_anthropic_spend_limit : given.a_vendor_response
{
    void Establish()
    {
        _response.Content = new StringContent("""{"error":{"type":"rate_limit_error","details":{"error_code":"enforced_spend_limit_reached"}}}""");
        _response.Headers.TryAddWithoutValidation("Retry-After", "30");
    }

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.Anthropic, "claude-sonnet-4", _providerId);

    [Fact] void should_name_the_vendor_model_status_type_and_code() => _failure.Result.FailureReason.ShouldContain("Anthropic model claude-sonnet-4 returned 429 rate_limit_error (enforced_spend_limit_reached)");
    [Fact] void should_say_the_quota_is_exhausted() => _failure.Result.FailureReason.ShouldContain("quota exhausted");
    [Fact] void should_name_the_provider() => _failure.Result.FailureReason.ShouldContain(_providerId.ToString());
    [Fact] void should_be_quota_exhausted() => _failure.Result.IsQuotaExhausted.ShouldBeTrue();
    [Fact] void should_not_be_retried_as_throttling() => _failure.Result.IsTransient.ShouldBeFalse();
    [Fact] void should_not_ask_for_a_retry_wait() => _failure.Result.RetryAfter.ShouldBeNull();
    [Fact] void should_preserve_the_raw_retry_after() => _failure.RetryAfter.ShouldEqual("30");
    [Fact] void should_preserve_the_vendor_body_for_the_caller() => _failure.Result.FailureReason.ShouldContain(_failure.Body);
    [Fact] void should_record_the_attempted_model() => _failure.Result.Model!.Value.ShouldEqual("claude-sonnet-4");
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.RateLimiting.for_ProviderRateLimit;

/// <summary>
/// This reads text a vendor wrote, passed through a harness - not a contract. So it is judged on
/// both counts: it has to recognize the phrasings that actually mean "the account is out", and it
/// must not park a healthy provider for an hour over an ordinary failure that happens to mention a
/// number.
/// </summary>
public class when_reading_a_failure : Specification
{
    [Fact] void should_recognize_a_rate_limit() => ProviderRateLimit.IsIndicatedBy("Request failed: rate limit exceeded").ShouldBeTrue();
    [Fact] void should_recognize_the_snake_cased_form() => ProviderRateLimit.IsIndicatedBy("error: rate_limit_exceeded").ShouldBeTrue();
    [Fact] void should_recognize_a_429() => ProviderRateLimit.IsIndicatedBy("unexpected status 429 Too Many Requests").ShouldBeTrue();
    [Fact] void should_recognize_a_spent_quota() => ProviderRateLimit.IsIndicatedBy("You have exceeded your current quota").ShouldBeTrue();
    [Fact] void should_recognize_a_plan_usage_limit() => ProviderRateLimit.IsIndicatedBy("You've hit your usage limit for this plan").ShouldBeTrue();
    [Fact] void should_ignore_case() => ProviderRateLimit.IsIndicatedBy("RATE LIMIT").ShouldBeTrue();

    // The failures that must not park a provider.
    [Fact] void should_not_read_a_compile_error_as_one() => ProviderRateLimit.IsIndicatedBy("Build failed with 3 errors").ShouldBeFalse();
    [Fact] void should_not_read_an_authentication_failure_as_one() => ProviderRateLimit.IsIndicatedBy("401 Unauthorized: invalid bearer token").ShouldBeFalse();
    [Fact] void should_not_read_a_dead_worker_as_one() => ProviderRateLimit.IsIndicatedBy("The worker died").ShouldBeFalse();
    [Fact] void should_not_read_nothing_as_one() => ProviderRateLimit.IsIndicatedBy(string.Empty).ShouldBeFalse();
}

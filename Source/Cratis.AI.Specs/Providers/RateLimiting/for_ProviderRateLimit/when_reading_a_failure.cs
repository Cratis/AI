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

    // Claude Code and harness wordings - none carries a status code.
    [Fact] void should_recognize_a_spent_subscription() => ProviderRateLimit.IsIndicatedBy("You've hit your limit · resets 3pm (UTC)").ShouldBeTrue();
    [Fact] void should_recognize_a_spent_weekly_window() => ProviderRateLimit.IsIndicatedBy("You've hit your weekly limit · resets Oct 9, 2am (UTC)").ShouldBeTrue();
    [Fact] void should_recognize_a_spent_five_hour_window() => ProviderRateLimit.IsIndicatedBy("You have hit your 5-hour limit").ShouldBeTrue();
    [Fact] void should_recognize_a_reached_five_hour_window() => ProviderRateLimit.IsIndicatedBy("5-hour limit reached ∙ resets 10:30pm").ShouldBeTrue();
    [Fact] void should_recognize_a_reached_weekly_window() => ProviderRateLimit.IsIndicatedBy("Weekly limit reached").ShouldBeTrue();
    [Fact] void should_recognize_a_reached_usage_limit() => ProviderRateLimit.IsIndicatedBy("usage limit reached").ShouldBeTrue();
    [Fact] void should_recognize_the_epoch_form() => ProviderRateLimit.IsIndicatedBy("Claude AI usage limit reached|1760000000").ShouldBeTrue();

    // The failures that must not park a provider.
    [Fact] void should_not_read_a_compile_error_as_one() => ProviderRateLimit.IsIndicatedBy("Build failed with 3 errors").ShouldBeFalse();
    [Fact] void should_not_read_an_authentication_failure_as_one() => ProviderRateLimit.IsIndicatedBy("401 Unauthorized: invalid bearer token").ShouldBeFalse();
    [Fact] void should_not_read_a_dead_worker_as_one() => ProviderRateLimit.IsIndicatedBy("The worker died").ShouldBeFalse();
    [Fact] void should_not_read_a_scope_instruction_as_one() => ProviderRateLimit.IsIndicatedBy("Tests failed: limit the scope of the change to the parser").ShouldBeFalse();
    [Fact] void should_not_read_a_rate_of_change_as_one() => ProviderRateLimit.IsIndicatedBy("The rate of change exceeded the threshold").ShouldBeFalse();
    [Fact] void should_not_read_a_context_window_limit_as_one() => ProviderRateLimit.IsIndicatedBy("Prompt is too long: the context limit was reached").ShouldBeFalse();
    [Fact] void should_not_read_nothing_as_one() => ProviderRateLimit.IsIndicatedBy(string.Empty).ShouldBeFalse();
}

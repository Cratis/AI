// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.RateLimiting.for_ProviderRateLimit;

/// <summary>
/// The reset a subscription states is what lets a provider be parked until its allowance actually
/// comes back, instead of retrying it hourly for days. Every form a vendor or harness is known to
/// use is read; anything else is <see langword="null"/>, never a guess.
/// </summary>
public class when_reading_a_reset : Specification
{
    static readonly DateTimeOffset _now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);

    [Fact] void should_read_a_date_without_a_year_as_its_next_occurrence() =>
        ProviderRateLimit.ResetIndicatedBy("You've hit your weekly limit · resets Oct 9, 2am (UTC)", _now).ShouldEqual(new DateTimeOffset(2026, 10, 9, 2, 0, 0, TimeSpan.Zero));

    [Fact] void should_read_a_date_already_past_this_year_as_next_year() =>
        ProviderRateLimit.ResetIndicatedBy("You've hit your weekly limit · resets Oct 1, 2am (UTC)", _now).ShouldEqual(new DateTimeOffset(2027, 10, 1, 2, 0, 0, TimeSpan.Zero));

    [Fact] void should_read_a_date_with_a_year() =>
        ProviderRateLimit.ResetIndicatedBy("resets Jan 3, 2027, 11pm (UTC)", _now).ShouldEqual(new DateTimeOffset(2027, 1, 3, 23, 0, 0, TimeSpan.Zero));

    [Fact] void should_read_a_later_time_today_as_today() =>
        ProviderRateLimit.ResetIndicatedBy("You've hit your limit · resets 3pm (UTC)", _now).ShouldEqual(new DateTimeOffset(2026, 10, 7, 15, 0, 0, TimeSpan.Zero));

    [Fact] void should_read_an_earlier_time_as_tomorrow() =>
        ProviderRateLimit.ResetIndicatedBy("You've hit your limit · resets 9am (UTC)", _now).ShouldEqual(new DateTimeOffset(2026, 10, 8, 9, 0, 0, TimeSpan.Zero));

    [Fact] void should_read_noon_as_twelve_pm() =>
        ProviderRateLimit.ResetIndicatedBy("resets 12pm (UTC)", _now.AddHours(-1)).ShouldEqual(new DateTimeOffset(2026, 10, 7, 12, 0, 0, TimeSpan.Zero));

    [Fact] void should_read_a_time_with_minutes_in_a_named_zone() =>
        ProviderRateLimit.ResetIndicatedBy("5-hour limit reached ∙ resets 10:30pm (Europe/Oslo)", _now).ShouldEqual(new DateTimeOffset(2026, 10, 7, 22, 30, 0, TimeSpan.FromHours(2)));

    [Fact] void should_not_guess_an_unknown_zone() =>
        ProviderRateLimit.ResetIndicatedBy("resets 3pm (Atlantis/Lost_City)", _now).ShouldBeNull();

    [Fact] void should_read_an_iso_timestamp() =>
        ProviderRateLimit.ResetIndicatedBy("Usage limit reached, resets at 2026-10-09T02:00:00Z", _now).ShouldEqual(new DateTimeOffset(2026, 10, 9, 2, 0, 0, TimeSpan.Zero));

    [Fact] void should_read_an_iso_timestamp_with_an_offset() =>
        ProviderRateLimit.ResetIndicatedBy("resets at 2026-10-09T04:00:00+02:00", _now).ShouldEqual(new DateTimeOffset(2026, 10, 9, 2, 0, 0, TimeSpan.Zero));

    [Fact] void should_read_the_epoch_suffix() =>
        ProviderRateLimit.ResetIndicatedBy("Claude AI usage limit reached|1760000000", _now).ShouldEqual(DateTimeOffset.FromUnixTimeSeconds(1760000000));

    [Fact] void should_not_read_a_failure_that_states_no_reset() =>
        ProviderRateLimit.ResetIndicatedBy("You've hit your weekly limit", _now).ShouldBeNull();

    [Fact] void should_not_read_nothing() =>
        ProviderRateLimit.ResetIndicatedBy(string.Empty, _now).ShouldBeNull();

    [Fact] void should_not_read_an_impossible_date() =>
        ProviderRateLimit.ResetIndicatedBy("resets Feb 30, 2am (UTC)", _now).ShouldBeNull();
}

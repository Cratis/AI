// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityCalculator;

/// <summary>
/// Headroom is the tightest window's remaining allowance, and whether work may start - and when it
/// may again - follows from that and from any rate limit in force.
/// </summary>
public class when_computing : Specification
{
    const double MinimumHeadroom = 0.02;
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly DateTimeOffset _now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
    static readonly DateTimeOffset _fiveHourReset = _now.AddHours(2);
    static readonly DateTimeOffset _weeklyReset = _now.AddDays(2);

    static AIProviderCapacity Compute(AIProviderCapacitySource source, IReadOnlyList<UsageWindow> windows, DateTimeOffset? rateLimitedUntil = null) =>
        AIProviderCapacityCalculator.Compute(_provider, source, windows, null, _now, rateLimitedUntil, _now, MinimumHeadroom);

    [Fact] void should_take_the_tightest_window_as_headroom() =>
        Compute(AIProviderCapacitySource.Subscription, [new(UsageWindowKind.FiveHour, "5-hour", 0.25, _fiveHourReset), new(UsageWindowKind.Weekly, "Weekly", 0.6, _weeklyReset)])
            .Headroom.ShouldEqual(0.4);

    [Fact] void should_clamp_an_overspent_window_to_no_headroom() =>
        Compute(AIProviderCapacitySource.Subscription, [new(UsageWindowKind.Weekly, "Weekly", 1.3, _weeklyReset)]).Headroom.ShouldEqual(0d);

    [Fact] void should_let_work_start_with_headroom_left() =>
        Compute(AIProviderCapacitySource.Subscription, [new(UsageWindowKind.FiveHour, "5-hour", 0.5, _fiveHourReset)]).CanStartWork.ShouldBeTrue();

    [Fact] void should_not_say_when_it_is_available_again_while_it_is_available() =>
        Compute(AIProviderCapacitySource.Subscription, [new(UsageWindowKind.FiveHour, "5-hour", 0.5, _fiveHourReset)]).AvailableAgainAt.ShouldBeNull();

    [Fact] void should_not_let_work_start_at_or_below_the_minimum_headroom() =>
        Compute(AIProviderCapacitySource.Subscription, [new(UsageWindowKind.FiveHour, "5-hour", 0.99, _fiveHourReset)]).CanStartWork.ShouldBeFalse();

    [Fact] void should_be_available_again_when_the_exhausted_window_resets() =>
        Compute(AIProviderCapacitySource.Subscription, [new(UsageWindowKind.FiveHour, "5-hour", 1, _fiveHourReset), new(UsageWindowKind.Weekly, "Weekly", 0.5, _weeklyReset)])
            .AvailableAgainAt.ShouldEqual(_fiveHourReset);

    [Fact] void should_be_available_again_only_once_every_exhausted_window_resets() =>
        Compute(AIProviderCapacitySource.Subscription, [new(UsageWindowKind.FiveHour, "5-hour", 1, _fiveHourReset), new(UsageWindowKind.Weekly, "Weekly", 1, _weeklyReset)])
            .AvailableAgainAt.ShouldEqual(_weeklyReset);

    [Fact] void should_give_a_configured_ceiling_its_remaining_share() =>
        Compute(AIProviderCapacitySource.ConfiguredCeiling, [new(UsageWindowKind.Other, "Configured capacity", 0.75, null)]).Headroom.ShouldEqual(0.25);

    [Fact] void should_give_an_unmetered_provider_full_headroom() =>
        Compute(AIProviderCapacitySource.Unmetered, []).Headroom.ShouldEqual(1d);

    [Fact] void should_give_an_unknown_provider_full_headroom_so_not_knowing_does_not_block_work() =>
        Compute(AIProviderCapacitySource.Unknown, []).CanStartWork.ShouldBeTrue();

    [Fact] void should_keep_saying_the_capacity_is_unknown() =>
        Compute(AIProviderCapacitySource.Unknown, []).Source.ShouldEqual(AIProviderCapacitySource.Unknown);

    [Fact] void should_leave_no_headroom_while_rate_limited() =>
        Compute(AIProviderCapacitySource.Unmetered, [], _now.AddHours(1)).Headroom.ShouldEqual(0d);

    [Fact] void should_not_let_work_start_while_rate_limited() =>
        Compute(AIProviderCapacitySource.Unmetered, [], _now.AddHours(1)).CanStartWork.ShouldBeFalse();

    [Fact] void should_be_available_again_when_the_rate_limit_lifts() =>
        Compute(AIProviderCapacitySource.Unmetered, [], _now.AddHours(1)).AvailableAgainAt.ShouldEqual(_now.AddHours(1));

    [Fact] void should_report_the_rate_limit_in_force() =>
        Compute(AIProviderCapacitySource.Unmetered, [], _now.AddHours(1)).RateLimitedUntil.ShouldEqual(_now.AddHours(1));

    [Fact] void should_be_available_again_at_a_later_window_reset_than_the_rate_limit() =>
        Compute(AIProviderCapacitySource.Subscription, [new(UsageWindowKind.Weekly, "Weekly", 1, _weeklyReset)], _now.AddHours(1)).AvailableAgainAt.ShouldEqual(_weeklyReset);

    [Fact] void should_ignore_a_rate_limit_that_has_lifted() =>
        Compute(AIProviderCapacitySource.Unmetered, [], _now.AddHours(-1)).CanStartWork.ShouldBeTrue();

    [Fact] void should_not_report_a_rate_limit_that_has_lifted() =>
        Compute(AIProviderCapacitySource.Unmetered, [], _now.AddHours(-1)).RateLimitedUntil.ShouldBeNull();
}

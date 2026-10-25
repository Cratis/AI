// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_AIProviderCapacityCalculator;

/// <summary>
/// When a provider cannot start work, the capacity says why in plain words - what is holding it, and until
/// when - so a failed chat can tell the person what to do instead of only that there is no capacity.
/// </summary>
public class explaining : Specification
{
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly DateTimeOffset _now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);

    static AIProviderCapacity Compute(IReadOnlyList<UsageWindow> windows, DateTimeOffset? rateLimitedUntil = null) =>
        AIProviderCapacityCalculator.Compute(_provider, AIProviderCapacitySource.Subscription, windows, null, _now, rateLimitedUntil, _now, 0.02);

    [Fact] void should_name_the_time_a_pause_lifts() =>
        Compute([], _now.AddMinutes(20)).Explain().ShouldContain("paused until 2026-10-07 12:20 UTC");

    [Fact] void should_say_how_to_lift_a_pause() =>
        Compute([], _now.AddMinutes(20)).Explain().ShouldContain("Settings > AI");

    [Fact] void should_name_the_spent_window_and_when_it_resets() =>
        Compute([new(UsageWindowKind.FiveHour, "5-hour", 1, _now.AddHours(2))]).Explain().ShouldContain("5-hour window 100% used (resets 2026-10-07 14:00 UTC)");

    [Fact] void should_say_when_there_is_capacity() =>
        Compute([new(UsageWindowKind.FiveHour, "5-hour", 0.1, _now.AddHours(2))]).Explain().ShouldEqual("has capacity");
}

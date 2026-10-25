// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_ChatGPTSubscriptionCapacity;

/// <summary>
/// ChatGPT reports a primary and a secondary window, told apart only by their length.
/// </summary>
public class when_parsing : Specification
{
    const string Json = """{ "plan_type": "plus", "rate_limit": { "allowed": true, "limit_reached": false, "primary_window": { "used_percent": 12, "limit_window_seconds": 18000, "reset_after_seconds": 3600, "reset_at": 1791262800 }, "secondary_window": { "used_percent": 55.5, "limit_window_seconds": 604800, "reset_after_seconds": 86400 } } }""";

    static readonly DateTimeOffset _now = new(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);

    IReadOnlyList<UsageWindow> _windows;

    void Because() => _windows = ChatGPTSubscriptionCapacity.Parse(Json, _now);

    [Fact] void should_read_both_windows() => _windows.Count.ShouldEqual(2);
    [Fact] void should_read_the_short_window_as_five_hours() => _windows[0].ShouldEqual(new UsageWindow(UsageWindowKind.FiveHour, "5-hour", 0.12, DateTimeOffset.FromUnixTimeSeconds(1791262800)));
    [Fact] void should_read_the_week_long_window_as_weekly_with_a_relative_reset() => _windows[1].ShouldEqual(new UsageWindow(UsageWindowKind.Weekly, "Weekly", 0.555, _now.AddDays(1)));
}

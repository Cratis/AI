// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_ClaudeSubscriptionCapacity;

/// <summary>
/// Claude's usage response gives utilization as a percentage per window, and sends a model-specific
/// weekly window as null when the plan has none.
/// </summary>
public class when_parsing : Specification
{
    const string Json = """{ "five_hour": { "utilization": 6.0, "resets_at": "2026-10-07T15:00:00.123456+00:00" }, "seven_day": { "utilization": 96, "resets_at": "2026-10-09T02:00:00+00:00" }, "seven_day_opus": { "utilization": 40.5, "resets_at": null }, "seven_day_sonnet": null, "extra_usage": { "is_enabled": false } }""";

    IReadOnlyList<UsageWindow> _windows;

    void Because() => _windows = ClaudeSubscriptionCapacity.Parse(Json);

    [Fact] void should_read_every_window_it_sent() => _windows.Count.ShouldEqual(3);
    [Fact] void should_read_the_five_hour_window() => _windows[0].ShouldEqual(new UsageWindow(UsageWindowKind.FiveHour, "5-hour", 0.06, new DateTimeOffset(2026, 10, 7, 15, 0, 0, 123, TimeSpan.Zero).AddTicks(4560)));
    [Fact] void should_read_the_weekly_window() => _windows[1].ShouldEqual(new UsageWindow(UsageWindowKind.Weekly, "Weekly", 0.96, new DateTimeOffset(2026, 10, 9, 2, 0, 0, TimeSpan.Zero)));
    [Fact] void should_read_the_opus_window_without_a_reset() => _windows[2].ShouldEqual(new UsageWindow(UsageWindowKind.Weekly, "Weekly (Opus)", 0.405, null));
}

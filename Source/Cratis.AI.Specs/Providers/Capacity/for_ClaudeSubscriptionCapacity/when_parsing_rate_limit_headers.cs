// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_ClaudeSubscriptionCapacity;

/// <summary>
/// A Messages response to a subscription request states each window's utilization as a fraction and its reset in
/// Unix seconds.
/// </summary>
public class when_parsing_rate_limit_headers : Specification
{
    IReadOnlyList<UsageWindow> _windows;

    void Because() => _windows = ClaudeSubscriptionCapacity.ParseHeaders(new Dictionary<string, string>
    {
        ["Anthropic-Ratelimit-Unified-5h-Utilization"] = "0.11",
        ["anthropic-ratelimit-unified-5h-reset"] = "1791511200",
        ["anthropic-ratelimit-unified-7d-utilization"] = "1.02",
        ["anthropic-ratelimit-unified-7d-reset"] = "1791511200",
        ["anthropic-ratelimit-unified-7d_sonnet-utilization"] = "not a number",
        ["anthropic-ratelimit-unified-status"] = "rejected",
    });

    [Fact] void should_read_the_windows_it_stated() => _windows.Count.ShouldEqual(2);
    [Fact] void should_read_the_five_hour_window_whatever_the_header_case() => _windows[0].ShouldEqual(new UsageWindow(UsageWindowKind.FiveHour, "5-hour", 0.11, DateTimeOffset.FromUnixTimeSeconds(1791511200)));
    [Fact] void should_clamp_a_weekly_window_used_past_its_allowance() => _windows[1].UsedFraction.ShouldEqual(1d);
}

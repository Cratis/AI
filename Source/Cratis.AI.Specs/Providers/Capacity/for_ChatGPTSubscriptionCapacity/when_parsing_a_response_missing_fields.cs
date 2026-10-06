// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_ChatGPTSubscriptionCapacity;

/// <summary>
/// The endpoint is undocumented, so a window without a length or a reset is still read, and one
/// without a used percentage - or a response with no rate limit at all - is not invented.
/// </summary>
public class when_parsing_a_response_missing_fields : Specification
{
    const string Json = """{ "rate_limit": { "primary_window": { "used_percent": "30" }, "secondary_window": { "limit_window_seconds": 604800 } } }""";

    IReadOnlyList<UsageWindow> _windows;
    IReadOnlyList<UsageWindow> _noRateLimit;

    void Because()
    {
        _windows = ChatGPTSubscriptionCapacity.Parse(Json, DateTimeOffset.UnixEpoch);
        _noRateLimit = ChatGPTSubscriptionCapacity.Parse("""{ "rate_limit": null }""", DateTimeOffset.UnixEpoch);
    }

    [Fact] void should_read_only_the_window_with_a_used_percentage() => _windows.Count.ShouldEqual(1);
    [Fact] void should_read_a_window_of_unknown_length_by_its_position() => _windows[0].ShouldEqual(new UsageWindow(UsageWindowKind.Other, "Primary", 0.3, null));
    [Fact] void should_read_no_windows_without_a_rate_limit() => _noRateLimit.ShouldBeEmpty();
}

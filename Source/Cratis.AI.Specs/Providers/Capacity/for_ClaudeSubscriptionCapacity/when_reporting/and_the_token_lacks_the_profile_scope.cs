// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.Capacity.for_ClaudeSubscriptionCapacity.when_reporting;

/// <summary>
/// A token from <c>claude setup-token</c> is refused by the usage endpoint, so the windows are read from the rate
/// limit headers of a one-token Messages request - here one the subscription is already over its weekly limit for.
/// </summary>
public class and_the_token_lacks_the_profile_scope : given.a_claude_subscription
{
    void Establish()
    {
        _answers[ClaudeSubscriptionCapacity.UsageUrl] = Answer(HttpStatusCode.Forbidden, """{"type":"error","error":{"type":"permission_error"}}""");
        _answers[ClaudeSubscriptionCapacity.MessagesUrl] = Answer(
            HttpStatusCode.TooManyRequests,
            "{}",
            ("anthropic-ratelimit-unified-5h-utilization", "0.3"),
            ("anthropic-ratelimit-unified-7d-utilization", "1.0"),
            ("anthropic-ratelimit-unified-7d-reset", "1791511200"));
    }

    Task Because() => Report();

    [Fact] void should_report_the_subscription() => _report.Source.ShouldEqual(AIProviderCapacitySource.Subscription);
    [Fact] void should_read_the_windows_from_the_headers() => _report.Windows.Select(window => window.Name).ShouldContainOnly("5-hour", "Weekly");
    [Fact] void should_read_the_weekly_reset() => _report.Windows.Single(window => window.Kind == UsageWindowKind.Weekly).ResetsAt.ShouldEqual(DateTimeOffset.FromUnixTimeSeconds(1791511200));
    [Fact] void should_probe_with_a_single_token() => _bodies[1].ShouldContain("\"max_tokens\":1");
}

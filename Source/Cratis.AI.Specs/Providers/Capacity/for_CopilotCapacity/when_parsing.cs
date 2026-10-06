// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_CopilotCapacity;

/// <summary>
/// Copilot's premium request allowance is monthly; an unlimited plan is unmetered, and a response
/// without one falls back to the configured ceiling rather than pretending to know.
/// </summary>
public class when_parsing : Specification
{
    const string Limited = """{ "copilot_plan": "individual", "quota_reset_date": "2026-11-01", "quota_snapshots": { "chat": { "unlimited": true, "percent_remaining": 100 }, "premium_interactions": { "entitlement": 300, "remaining": 75, "percent_remaining": 25.0, "unlimited": false } } }""";

    const string Unlimited = """{ "quota_snapshots": { "premium_interactions": { "unlimited": true, "percent_remaining": 100 } } }""";

    AIProviderCapacityReport _limited;
    AIProviderCapacityReport _unlimited;
    AIProviderCapacityReport _none;

    void Because()
    {
        _limited = CopilotCapacity.Parse(Limited);
        _unlimited = CopilotCapacity.Parse(Unlimited);
        _none = CopilotCapacity.Parse("""{ "copilot_plan": "free" }""");
    }

    [Fact] void should_report_a_limited_plan_as_a_subscription() => _limited.Source.ShouldEqual(AIProviderCapacitySource.Subscription);
    [Fact] void should_read_the_monthly_premium_window() => _limited.Windows.Single().ShouldEqual(new UsageWindow(UsageWindowKind.Monthly, CopilotCapacity.PremiumRequests, 0.75, new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero)));
    [Fact] void should_report_an_unlimited_plan_as_unmetered() => _unlimited.Source.ShouldEqual(AIProviderCapacitySource.Unmetered);
    [Fact] void should_report_no_window_for_an_unlimited_plan() => _unlimited.Windows.ShouldBeEmpty();
    [Fact] void should_fall_back_without_a_premium_quota() => _none.FallsBack.ShouldBeTrue();
}

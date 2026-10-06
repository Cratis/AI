// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity.for_ZAICodingPlanCapacity;

/// <summary>
/// A Z.AI coding plan reports its windows as rows of a unit and a number; rows that are not token or
/// credit limits are left out, and a key that is not on a coding plan reports nothing to read.
/// </summary>
public class when_parsing : Specification
{
    const string CodingPlan = """{ "code": 200, "msg": "Operation successful", "success": true, "data": { "limits": [ { "type": "TOKENS_LIMIT", "unit": 3, "number": 5, "percentage": 42, "nextResetTime": 1791262800000 }, { "type": "TOKENS_LIMIT", "unit": 6, "number": 1, "percentage": 10, "nextResetTime": 1791504000000 }, { "type": "TIME_LIMIT", "unit": 5, "number": 1, "percentage": 3, "usage": 1000, "currentValue": 30 } ] } }""";

    const string NotACodingPlan = """{ "code": 1001, "msg": "No coding plan", "success": false }""";

    IReadOnlyList<UsageWindow>? _windows;
    IReadOnlyList<UsageWindow>? _notACodingPlan;

    void Because()
    {
        _windows = ZAICodingPlanCapacity.Parse(CodingPlan);
        _notACodingPlan = ZAICodingPlanCapacity.Parse(NotACodingPlan);
    }

    [Fact] void should_read_only_the_token_windows() => _windows!.Count.ShouldEqual(2);
    [Fact] void should_read_the_five_hour_window() => _windows![0].ShouldEqual(new UsageWindow(UsageWindowKind.FiveHour, "5-hour", 0.42, DateTimeOffset.FromUnixTimeMilliseconds(1791262800000)));
    [Fact] void should_read_the_weekly_window() => _windows![1].ShouldEqual(new UsageWindow(UsageWindowKind.Weekly, "Weekly", 0.1, DateTimeOffset.FromUnixTimeMilliseconds(1791504000000)));
    [Fact] void should_read_nothing_for_a_key_without_a_coding_plan() => _notACodingPlan.ShouldBeNull();
}

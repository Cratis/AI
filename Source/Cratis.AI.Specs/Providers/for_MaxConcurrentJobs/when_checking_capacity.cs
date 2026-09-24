// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_MaxConcurrentJobs;

/// <summary>
/// Zero means no limit - what a provider starts with, and what every provider configured before the
/// bound existed replays as - so the unset case has to read as unbounded rather than as "no capacity".
/// </summary>
public class when_checking_capacity : Specification
{
    [Fact] void should_treat_the_unset_value_as_unlimited() => MaxConcurrentJobs.NotSet.HasCapacityFor(100).ShouldBeTrue();
    [Fact] void should_not_report_the_unset_value_as_limited() => MaxConcurrentJobs.NotSet.IsLimited.ShouldBeFalse();
    [Fact] void should_have_room_below_the_limit() => new MaxConcurrentJobs(2).HasCapacityFor(1).ShouldBeTrue();
    [Fact] void should_have_no_room_at_the_limit() => new MaxConcurrentJobs(2).HasCapacityFor(2).ShouldBeFalse();
    [Fact] void should_have_no_room_above_the_limit() => new MaxConcurrentJobs(2).HasCapacityFor(3).ShouldBeFalse();
    [Fact] void should_have_room_on_an_idle_bounded_provider() => new MaxConcurrentJobs(1).HasCapacityFor(0).ShouldBeTrue();
}

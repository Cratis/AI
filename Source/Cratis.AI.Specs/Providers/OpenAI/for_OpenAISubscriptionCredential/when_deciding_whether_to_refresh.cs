// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.OpenAI.for_OpenAISubscriptionCredential;

/// <summary>
/// A worker session cannot renew its own credential without retiring the one Stagehand holds, so the
/// question is not "has it expired" but "will it last the session" - which is why the margin exists.
/// </summary>
public class when_deciding_whether_to_refresh : Specification
{
    static readonly DateTimeOffset _now = new(2026, 9, 4, 12, 0, 0, TimeSpan.Zero);
    static readonly TimeSpan _margin = TimeSpan.FromMinutes(30);

    static OpenAISubscriptionCredential Expiring(TimeSpan fromNow) => new("at", "rt", _now.Add(fromNow).ToUnixTimeMilliseconds(), null);

    [Fact] void should_refresh_one_that_has_already_expired() => Expiring(TimeSpan.FromHours(-1)).NeedsRefresh(_margin, _now).ShouldBeTrue();
    [Fact] void should_refresh_one_expiring_inside_the_margin() => Expiring(TimeSpan.FromMinutes(10)).NeedsRefresh(_margin, _now).ShouldBeTrue();
    [Fact] void should_refresh_one_expiring_exactly_at_the_margin() => Expiring(_margin).NeedsRefresh(_margin, _now).ShouldBeTrue();
    [Fact] void should_leave_one_with_plenty_of_life() => Expiring(TimeSpan.FromHours(4)).NeedsRefresh(_margin, _now).ShouldBeFalse();
}

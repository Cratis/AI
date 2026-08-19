// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.WeeklyDigests.Receiving.when_receiving_weekly_digest;

public class and_content_is_given : Specification
{
    CommandScenario<ReceiveWeeklyDigest> _scenario;
    CommandResult _result;

    void Establish() => _scenario = new();

    async Task Because() => _result = await _scenario.Execute(new ReceiveWeeklyDigest("Shipped the new dashboard and fixed 12 bugs."));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact]
    void should_append_weekly_digest_received() => _scenario.EventSequence.ShouldHaveAppendedEvent<WeeklyDigestReceived>(
        @event => @event.Content == new WeeklyDigestContent("Shipped the new dashboard and fixed 12 bugs."));
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.Capacity.for_ClaudeSubscriptionCapacity.when_reporting;

public class and_the_usage_endpoint_answers : given.a_claude_subscription
{
    void Establish() =>
        _answers[ClaudeSubscriptionCapacity.UsageUrl] = Answer(HttpStatusCode.OK, """{ "five_hour": { "utilization": 10, "resets_at": null } }""");

    Task Because() => Report();

    [Fact] void should_read_its_windows() => _report.Windows.Single().UsedFraction.ShouldEqual(0.1);
    [Fact] void should_not_spend_a_messages_request() => _requests.Count.ShouldEqual(1);
}

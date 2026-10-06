// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.Capacity.for_ClaudeSubscriptionCapacity.when_reporting;

public class and_neither_answer_states_its_usage : given.a_claude_subscription
{
    void Establish()
    {
        _answers[ClaudeSubscriptionCapacity.UsageUrl] = Answer(HttpStatusCode.Forbidden);
        _answers[ClaudeSubscriptionCapacity.MessagesUrl] = Answer(HttpStatusCode.Unauthorized);
    }

    Task Because() => Report();

    [Fact] void should_not_know() => _report.Source.ShouldEqual(AIProviderCapacitySource.Unknown);
    [Fact] void should_say_why() => _report.Problem!.ShouldContain("stated no usage windows");
}

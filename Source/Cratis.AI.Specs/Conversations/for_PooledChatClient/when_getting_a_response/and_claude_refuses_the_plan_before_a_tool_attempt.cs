// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

public class and_claude_refuses_the_plan_before_a_tool_attempt : given.a_claude_model_refusal
{
    void Establish() => _code = "billing_error";

    Task Because() => Respond();

    [Fact] void should_answer_from_the_next_member() => _response.Text.ShouldEqual("fallback");
    [Fact] void should_remember_the_failed_member() => _failures.Received(1).Record(_first);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Anthropic;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.when_getting_a_response;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_the_native_tool_request_completes_without_starting_the_function : given.a_native_claude_rate_limit
{
    Exception? _fixtureError;

    void Establish()
    {
        _rateLimitDuringTool = true;

        // The server returns an HTTP-successful JSON-RPC rejection for the unregistered "act" tool.
        _chatOptions.Tools = [AIFunctionFactory.Create(() => "unused", "another_tool")];
    }

    async Task Because() => _fixtureError = await Catch.Exception(() => Respond(false));

    [Fact] void should_surface_the_fixture_precondition_failure_after_the_scenario_captures_its_error() => _fixtureError!.Message.ShouldContain("fixture precondition failed: the HTTP request completed before the function started");
    [Fact] void should_not_attempt_the_function() => _attempts.ShouldEqual(0);
}

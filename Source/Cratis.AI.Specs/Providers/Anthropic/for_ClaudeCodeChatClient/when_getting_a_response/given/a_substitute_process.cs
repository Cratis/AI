// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response.given;

public class a_substitute_process : Specification
{
    protected IClaudeCodeStreamingProcess _process = null!;
    protected ClaudeCodeChatClient _client = null!;
    protected List<ChatMessage> _messages = null!;

    void Establish()
    {
        _process = Substitute.For<IClaudeCodeStreamingProcess>();
        _client = new(_process, " sk-ant-oat-token \n", "claude-sonnet-4-6");
        _messages = [new ChatMessage(ChatRole.User, "What is the capital of Norway?")];
    }

    protected void Produces(params string[] lines) =>
        _process.Run(Arg.Any<ProcessStartInfo>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(Lines(lines));

    static async IAsyncEnumerable<string> Lines(string[] lines)
    {
        foreach (var line in lines)
        {
            await Task.Yield();
            yield return line;
        }
    }

    void Destroy() => _client.Dispose();
}

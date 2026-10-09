// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class with_an_invalid_factory_preference : given.a_substitute_process
{
    Exception? _error;

    void Establish() => _client = new(_process, "sk-ant-oat-token", "sonnet") { UseVendorDefaults = true };

    async Task Because() => _error = await Catch.Exception(() => _client.GetResponseAsync(_messages, new ChatOptions { MaxOutputTokens = -1 }));

    [Fact] void should_reject_invalid_preferences() => _error.ShouldBeOfExactType<ClaudeCodeConversationFailed>();
    [Fact] void should_not_start_the_child() => _process.DidNotReceive().Run(Arg.Any<ProcessStartInfo>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
}

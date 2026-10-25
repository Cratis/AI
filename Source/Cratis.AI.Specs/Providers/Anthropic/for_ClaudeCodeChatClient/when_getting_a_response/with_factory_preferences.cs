// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class with_factory_preferences : given.a_substitute_process
{
    ChatResponse _response = null!;
    readonly ChatOptions _options = new() { Temperature = 0.6f, MaxOutputTokens = 8192 };

    void Establish()
    {
        _client = new(_process, "sk-ant-oat-token", "sonnet") { UseVendorDefaults = true };
        Produces("""{"type":"result","subtype":"success","result":"done"}""");
    }

    async Task Because() => _response = await _client.GetResponseAsync(_messages, _options);

    [Fact] void should_serve_generic_conversation_defaults() => _response.Text.ShouldEqual("done");
    [Fact] void should_report_unsupported_preferences_explicitly() => ((IReadOnlyList<string>)_response.AdditionalProperties!["vendor_controlled_options"]!).ShouldContainOnly("Temperature", "MaxOutputTokens");
    [Fact] void should_not_mutate_caller_options() => _options.MaxOutputTokens.ShouldEqual(8192);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeChatClient.when_getting_a_response;

public class and_the_vendor_rejects_the_token_after_retrying : given.a_substitute_process
{
    ClaudeCodeConversationFailed? _error;

    void Establish() => Produces(
        """{"type":"system","subtype":"init","session_id":"session-1"}""",
        """{"type":"system","subtype":"api_retry","attempt":1,"max_retries":10,"retry_delay_ms":569,"error_status":401,"error":"authentication_failed","session_id":"session-1"}""",
        """{"type":"assistant","error":"authentication_failed","message":{"role":"assistant","content":[{"type":"text","text":"Failed to authenticate. API Error: 401 sk-ant-oat-token"}]}}""",
        """{"type":"result","subtype":"success","is_error":true,"api_error_status":401,"session_id":"session-1","result":"Failed to authenticate"}""");

    async Task Because() => _error = (await Catch.Exception(() => _client.GetResponseAsync(_messages))) as ClaudeCodeConversationFailed;

    [Fact] void should_fail_as_a_conversation_failure() => _error.ShouldNotBeNull();
    [Fact] void should_classify_it_as_authentication() => _error!.Kind.ShouldEqual(ClaudeCodeFailureKind.Authentication);
    [Fact] void should_name_the_code() => _error!.Message.ShouldContain("authentication_failed");
    [Fact] void should_name_the_http_status() => _error!.Message.ShouldContain("HTTP 401");
    [Fact] void should_not_repeat_the_vendors_text() => _error!.Message.Contains("sk-ant", StringComparison.Ordinal).ShouldBeFalse();
}

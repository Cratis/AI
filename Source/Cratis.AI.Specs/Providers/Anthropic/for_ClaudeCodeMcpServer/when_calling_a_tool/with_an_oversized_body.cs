// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Http.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_calling_a_tool;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class with_an_oversized_body : given.a_running_server
{
    HttpStatusCode _status;

    async Task Because()
    {
        using var response = await _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", id = 1, method = "tools/call", @params = new { name = "echo", arguments = new { text = new string('x', (1024 * 1024) + 1) } } });
        _status = response.StatusCode;
    }

    [Fact] void should_bound_the_request_body() => _status.ShouldEqual(HttpStatusCode.RequestEntityTooLarge);
    [Fact] void should_never_invoke_the_tool() => _lastSeenArgument.ShouldBeNull();
}

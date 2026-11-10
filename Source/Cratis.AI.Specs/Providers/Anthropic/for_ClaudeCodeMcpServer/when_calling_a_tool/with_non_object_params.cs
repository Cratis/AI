// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Http.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_calling_a_tool;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class with_non_object_params : given.a_running_server
{
    HttpStatusCode _status;

    async Task Because()
    {
        using var response = await _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", id = 1, method = "tools/call", @params = new[] { "echo" } });
        _status = response.StatusCode;
    }

    [Fact] void should_reject_the_request() => _status.ShouldEqual(HttpStatusCode.BadRequest);
    [Fact] void should_not_invoke_the_tool() => _lastSeenArgument.ShouldBeNull();
}

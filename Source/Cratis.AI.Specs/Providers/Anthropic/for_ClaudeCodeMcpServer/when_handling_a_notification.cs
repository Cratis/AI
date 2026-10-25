// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Http.Json;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class when_handling_a_notification : given.a_running_server
{
    HttpResponseMessage _response = null!;

    async Task Because() => _response = await _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", method = "notifications/initialized" });

    [Fact] void should_acknowledge_without_a_jsonrpc_body() => _response.StatusCode.ShouldEqual(HttpStatusCode.Accepted);
}

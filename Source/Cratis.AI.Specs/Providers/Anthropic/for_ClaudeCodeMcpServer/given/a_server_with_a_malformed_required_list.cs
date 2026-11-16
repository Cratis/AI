// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.given;

public abstract class a_server_with_a_malformed_required_list : Specification
{
    protected JsonElement _withArguments;
    protected JsonElement _withoutArguments;
    protected HttpStatusCode _withArgumentsStatus;
    protected HttpStatusCode _withoutArgumentsStatus;
    protected bool _invoked;
    ClaudeCodeMcpServer _server = null!;
    HttpClient _http = null!;

    protected abstract string Required { get; }

    void Establish()
    {
        var inner = AIFunctionFactory.Create(Invoke, "tool");
        var schema = JsonSerializer.SerializeToElement(new { type = "object", required = JsonSerializer.Deserialize<JsonElement>(Required) });
        _server = new([new malformed_function(inner, schema)]);
        _server.Start();
        _http = new HttpClient();
        _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", _server.Authorization);
    }

    string Invoke()
    {
        _invoked = true;
        return "done";
    }

    protected async Task CallTool()
    {
        using var withArguments = await _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", id = 1, method = "tools/call", @params = new { name = "tool", arguments = new { } } });
        _withArgumentsStatus = withArguments.StatusCode;
        _withArguments = await withArguments.Content.ReadFromJsonAsync<JsonElement>();
        using var withoutArguments = await _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", id = 2, method = "tools/call", @params = new { name = "tool" } });
        _withoutArgumentsStatus = withoutArguments.StatusCode;
        _withoutArguments = await withoutArguments.Content.ReadFromJsonAsync<JsonElement>();
    }

    async Task Destroy()
    {
        await _server.DisposeAsync();
        _http.Dispose();
    }

    sealed class malformed_function(AIFunction inner, JsonElement schema) : DelegatingAIFunction(inner)
    {
        public override JsonElement JsonSchema => schema;
    }
}

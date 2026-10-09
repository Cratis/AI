// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.given;

public class a_running_server : Specification
{
    protected ClaudeCodeMcpServer _server = null!;
    protected HttpClient _http = null!;
    protected AIFunction _echo = null!;
    protected AIFunction _failing = null!;
    protected string? _lastSeenArgument;

    void Establish()
    {
        _echo = AIFunctionFactory.Create(
            (string text) =>
            {
                _lastSeenArgument = text;
                return $"echo:{text}";
            },
            "echo",
            "Echoes the given text back.");

        Func<string> throwing = () => throw new InvalidOperationException("secret-token-password");
        _failing = AIFunctionFactory.Create(throwing, "failing", "Always fails.");

        _server = new ClaudeCodeMcpServer([_echo, _failing], "cratis");
        _server.Start();
        _http = new HttpClient();
        _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", _server.Authorization);
    }

    protected async Task<JsonElement> Call(object jsonRpcRequest)
    {
        using var response = await _http.PostAsJsonAsync(_server.Endpoint, jsonRpcRequest);
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    async Task Destroy()
    {
        _http.Dispose();
        await _server.DisposeAsync();
    }
}

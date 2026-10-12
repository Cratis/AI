// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_starting;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_its_reserved_port_is_taken : Specification
{
    ClaudeCodeMcpServer _server = null!;
    TcpListener _occupant = null!;
    HttpClient _http = null!;
    int _reservedPort;
    Exception? _error;
    HttpStatusCode? _status;

    void Establish()
    {
        _server = new([]);
        _reservedPort = _server.Endpoint.Port;
        _occupant = new TcpListener(IPAddress.Loopback, _reservedPort);
        _occupant.Start();
        _http = new HttpClient();
        _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", _server.Authorization);
    }

    async Task Because()
    {
        _error = Catch.Exception(_server.Start);
        if (_error is not null) return;
        using var response = await _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", id = 1, method = "ping" });
        _status = response.StatusCode;
    }

    [Fact] void should_start() => _error.ShouldBeNull();
    [Fact] void should_listen_on_another_port() => _server.Endpoint.Port.ShouldNotEqual(_reservedPort);
    [Fact] void should_serve_requests() => _status.ShouldEqual(HttpStatusCode.OK);

    async Task Destroy()
    {
        _http.Dispose();
        _occupant.Dispose();
        await _server.DisposeAsync();
    }
}

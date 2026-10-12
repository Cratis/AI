// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Sockets;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_disposing.without_having_started;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_its_port_is_in_use : Specification
{
    ClaudeCodeMcpServer _server = null!;
    TcpListener _occupant = null!;
    Exception? _error;

    void Establish()
    {
        _server = new([]);
        _occupant = new TcpListener(IPAddress.Loopback, _server.Endpoint.Port);
        _occupant.Start();
    }

    async Task Because() => _error = await Catch.Exception(async () => await _server.DisposeAsync());

    [Fact] void should_not_touch_the_port() => _error.ShouldBeNull();

    void Destroy() => _occupant.Dispose();
}

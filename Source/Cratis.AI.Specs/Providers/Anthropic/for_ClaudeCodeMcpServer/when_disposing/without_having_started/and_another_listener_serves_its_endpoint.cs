// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_disposing.without_having_started;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_another_listener_serves_its_endpoint : Specification
{
    ClaudeCodeMcpServer _server = null!;
    HttpListener _other = null!;
    HttpClient _http = null!;
    Task _serving = null!;
    Exception? _error;
    HttpStatusCode? _status;

    void Establish()
    {
        _server = new([]);
        _other = new HttpListener();
        _other.Prefixes.Add(_server.Endpoint.ToString());
        _other.Start();
        _serving = Serve();
        _http = new HttpClient();
    }

    async Task Because()
    {
        await _server.DisposeAsync();
        _error = await Catch.Exception(async () =>
        {
            using var response = await _http.GetAsync(_server.Endpoint);
            _status = response.StatusCode;
        });
    }

    [Fact] void should_leave_the_other_listener_reachable() => _error.ShouldBeNull();
    [Fact] void should_leave_the_other_listener_answering() => _status.ShouldEqual(HttpStatusCode.NoContent);

    async Task Serve()
    {
        var context = await _other.GetContextAsync();
        context.Response.StatusCode = (int)HttpStatusCode.NoContent;
        context.Response.Close();
    }

    async Task Destroy()
    {
        _http.Dispose();
        _other.Close();

        // Closing the listener faults a pending accept; the served request already proved what it had to.
        await Catch.Exception(() => _serving);
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_disposing;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class with_a_cancellable_active_call : Specification
{
    ClaudeCodeMcpServer _server = null!;
    HttpClient _http = null!;
    Task<HttpResponseMessage> _request = null!;
    readonly TaskCompletionSource _entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
    readonly TaskCompletionSource _neverCompletes = new(TaskCreationOptions.RunContinuationsAsynchronously);
    bool _canceled;
    bool _finished;

    async Task Establish()
    {
        var tool = AIFunctionFactory.Create(Wait, "wait");
        _server = new([tool]);
        _server.Start();
        _http = new HttpClient();
        _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", _server.Authorization);
        _request = _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", id = 1, method = "tools/call", @params = new { name = "wait", arguments = new { } } });
        await _entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
    }

    async Task Because() => await _server.DisposeAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(5));

    [Fact] void should_cancel_the_active_tool() => _canceled.ShouldBeTrue();
    [Fact] void should_drain_the_active_tool_before_returning() => _finished.ShouldBeTrue();

    async Task<string> Wait(CancellationToken cancellationToken)
    {
        _entered.TrySetResult();
        try
        {
            await _neverCompletes.Task.WaitAsync(cancellationToken);
            return "done";
        }
        finally
        {
            _canceled = cancellationToken.IsCancellationRequested;
            _finished = true;
        }
    }

    async Task Destroy()
    {
        _neverCompletes.TrySetResult();
        await Catch.Exception(async () => { using var response = await _request; });
        await _server.DisposeAsync();
        _http.Dispose();
    }
}

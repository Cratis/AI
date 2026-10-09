// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_disposing;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class with_an_active_call : Specification
{
    ClaudeCodeMcpServer _server = null!;
    HttpClient _http = null!;
    Task<HttpResponseMessage> _request = null!;
    readonly TaskCompletionSource _entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
    readonly TaskCompletionSource _release = new(TaskCreationOptions.RunContinuationsAsynchronously);
    bool _returnedBeforeRelease;
    bool _finished;

    async Task Establish()
    {
        var tool = AIFunctionFactory.Create(
            async () =>
        {
            _entered.SetResult();
            await _release.Task;
            _finished = true;
            return "done";
        },
            "wait");
        _server = new([tool]);
        _server.Start();
        _http = new HttpClient();
        _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", _server.Authorization);
        _request = _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", id = 1, method = "tools/call", @params = new { name = "wait", arguments = new { } } });
        await _entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
    }

    async Task Because()
    {
        var disposal = _server.DisposeAsync().AsTask();
        _returnedBeforeRelease = disposal.IsCompleted;
        _release.SetResult();
        await disposal.WaitAsync(TimeSpan.FromSeconds(5));
    }

    [Fact] void should_wait_for_the_call_to_leave_the_scope() => _returnedBeforeRelease.ShouldBeFalse();
    [Fact] void should_finish_the_call_before_returning() => _finished.ShouldBeTrue();

    async Task Destroy()
    {
        _release.TrySetResult();
        await Catch.Exception(async () => { using var response = await _request; });
        await _server.DisposeAsync();
        _http.Dispose();
    }
}

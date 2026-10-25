// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class when_saturated : Specification
{
    ClaudeCodeMcpServer _server = null!;
    HttpClient _http = null!;
    readonly TaskCompletionSource _entered = new(TaskCreationOptions.RunContinuationsAsynchronously);
    readonly TaskCompletionSource _release = new(TaskCreationOptions.RunContinuationsAsynchronously);
    readonly List<Task<HttpResponseMessage>> _requests = [];
    int _calls;
    HttpStatusCode _status;

    async Task Establish()
    {
        var tool = AIFunctionFactory.Create(Wait, "wait");
        _server = new([tool]);
        _server.Start();
        _http = new HttpClient();
        _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", _server.Authorization);
        for (var index = 0; index < 8; index++) _requests.Add(Call());
        await _entered.Task.WaitAsync(TimeSpan.FromSeconds(5));
    }

    async Task Because()
    {
        using var response = await Call();
        _status = response.StatusCode;
    }

    [Fact] void should_refuse_excess_concurrency() => _status.ShouldEqual(HttpStatusCode.TooManyRequests);
    [Fact] void should_not_invoke_the_ninth_call() => _calls.ShouldEqual(8);

    async Task<string> Wait()
    {
        if (Interlocked.Increment(ref _calls) == 8) _entered.TrySetResult();
        await _release.Task;
        return "done";
    }

    Task<HttpResponseMessage> Call() => _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", id = 1, method = "tools/call", @params = new { name = "wait", arguments = new { } } });

    async Task Destroy()
    {
        _release.TrySetResult();
        foreach (var request in _requests)
        {
            using var response = await request;
        }

        await _server.DisposeAsync();
        _http.Dispose();
    }
}

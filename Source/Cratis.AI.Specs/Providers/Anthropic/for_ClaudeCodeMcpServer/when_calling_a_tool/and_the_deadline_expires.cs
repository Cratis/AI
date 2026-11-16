// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic.for_ClaudeCodeMcpServer.when_calling_a_tool;

[Collection(ClaudeCodeMcpServerCollection.Name)]
public class and_the_deadline_expires : Specification
{
    ClaudeCodeMcpServer _server = null!;
    HttpClient _http = null!;
    JsonElement _response;
    JsonElement _subsequentResponse;
    readonly TaskCompletionSource _neverCompletes = new(TaskCreationOptions.RunContinuationsAsynchronously);
    bool _canceled;

    void Establish()
    {
        var waiting = AIFunctionFactory.Create(Wait, "wait");
        var echo = AIFunctionFactory.Create(() => "done", "echo");
        _server = new([waiting, echo]) { ToolCallTimeout = TimeSpan.FromMilliseconds(10) };
        _server.Start();
        _http = new HttpClient();
        _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", _server.Authorization);
    }

    async Task Because()
    {
        _response = await Call("wait");
        _subsequentResponse = await Call("echo");
    }

    [Fact] void should_cancel_the_tool() => _canceled.ShouldBeTrue();
    [Fact] void should_report_the_call_as_failed() => _response.GetProperty("result").GetProperty("isError").GetBoolean().ShouldBeTrue();
    [Fact] void should_use_the_existing_failure_text() => _response.GetProperty("result").GetProperty("content")[0].GetProperty("text").GetString().ShouldEqual("The tool could not complete the request.");
    [Fact] void should_return_a_result_not_an_error_envelope() => _response.TryGetProperty("error", out _).ShouldBeFalse();
    [Fact] void should_leave_the_server_available_for_other_calls() => _subsequentResponse.GetProperty("result").GetProperty("isError").GetBoolean().ShouldBeFalse();

    async Task<string> Wait(CancellationToken cancellationToken)
    {
        try
        {
            await _neverCompletes.Task.WaitAsync(cancellationToken);
            return "done";
        }
        finally
        {
            _canceled = cancellationToken.IsCancellationRequested;
        }
    }

    async Task<JsonElement> Call(string name)
    {
        using var response = await _http.PostAsJsonAsync(_server.Endpoint, new { jsonrpc = "2.0", id = 1, method = "tools/call", @params = new { name, arguments = new { } } }).WaitAsync(TimeSpan.FromSeconds(5));
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }

    async Task Destroy()
    {
        _neverCompletes.TrySetResult();
        await _server.DisposeAsync();
        _http.Dispose();
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Net.Http.Json;
using System.Text.Json;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Anthropic;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.RateLimiting;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations.for_PooledChatClient.given;

public class a_native_claude_rate_limit : a_pooled_chat_client
{
    protected bool _invokeTool = true;
    protected bool _failTool;
    protected int _attempts;
    protected Exception? _error;
    protected string _text = string.Empty;
    protected ClaudeCodeConversationFailed _failure;
    protected ChatOptions _chatOptions;
    protected AIProviderId _first;
    protected AIProviderId _second;
    protected ProcessStartInfo _startInfo;
    protected IDisposable _slot;
    protected IDisposable _functionResource;
    protected bool _cancelAfterTool;
    protected CancellationTokenSource _cancellation;
    protected OperationCanceledException _cancelled;
    protected bool _rateLimitDuringTool;
    protected bool _toolDrained;
    protected bool _emitText;
    protected bool _malformedOutput;
    protected bool _endWithoutResult;
    protected bool _failDirectoryCleanup;
    protected Exception? _transportError;
    protected tracking_native_chat_client _nativeChat;
    readonly TaskCompletionSource _toolStarted = new(TaskCreationOptions.RunContinuationsAsynchronously);
    Task<HttpResponseMessage>? _pendingRequest;
    readonly HttpClient _http = new();

    static async Task<(string Url, string Authorization)> Connection(ProcessStartInfo info)
    {
        using var config = JsonDocument.Parse(await File.ReadAllTextAsync(info.ArgumentList[info.ArgumentList.IndexOf("--mcp-config") + 1]));
        var server = config.RootElement.GetProperty("mcpServers").GetProperty("cratis");
        return (server.GetProperty("url").GetString()!, server.GetProperty("headers").GetProperty("Authorization").GetString()!);
    }

    void Establish()
    {
        _cancellation = new CancellationTokenSource();
        _cancelled = new OperationCanceledException(_cancellation.Token);
        _slot = Substitute.For<IDisposable>();
        _functionResource = Substitute.For<IDisposable>();
        var gate = Substitute.For<IProviderConcurrencyGate>();
        gate.TryEnter(Arg.Any<AIProviderId>(), Arg.Any<CancellationToken>()).Returns(_slot);
        _client = new((LanguageModels.LanguageModelPurpose)Purpose, _readModels, _compatibility, _burn, _usageLevels, _capacities, _failures, gate, _factory, _agents, _execution, _commandPipeline, _recorder, TimeProvider.System, _options, Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance);
        _first = AIProviderId.New();
        _second = AIProviderId.New();
        var pool = AIProviderPoolId.New();
        AgentDrawsFromPool(pool);
        PoolIs(pool, _first, _second);
        ProviderIs(_first, AIProviderType.Anthropic);
        ProviderIs(_second, AIProviderType.OpenAI);
        _failure = new ClaudeCodeConversationFailed("Claude Code is rate limited. Try again after the account's usage window resets.", kind: ClaudeCodeFailureKind.RateLimit);
        var process = Substitute.For<IClaudeCodeStreamingProcess>();
        process.Run(Arg.Any<ProcessStartInfo>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(call => RunChild(call.Arg<ProcessStartInfo>()));
        var native = new ClaudeCodeChatClient(process, "sk-ant-oat-test-only", "sonnet");
        _nativeChat = new tracking_native_chat_client(native);
        _factory.Create(Arg.Is<ConfiguredAIProvider>(provider => provider.Id == _first), Arg.Any<ModelName>())
            .Returns(Task.FromResult<IChatClient?>(_anthropicChat));
        _anthropicChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(call => _nativeChat.GetResponseAsync(call.Arg<IEnumerable<ChatMessage>>(), call.Arg<ChatOptions>(), call.Arg<CancellationToken>()));
        _anthropicChat.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(call => _nativeChat.GetStreamingResponseAsync(call.Arg<IEnumerable<ChatMessage>>(), call.Arg<ChatOptions>(), call.Arg<CancellationToken>()));
        _chatOptions = new ChatOptions { Tools = [AIFunctionFactory.Create(Act, "act")] };
        _openAIChat.GetResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(new ChatResponse(new ChatMessage(ChatRole.Assistant, "fallback")));
        _openAIChat.GetStreamingResponseAsync(Arg.Any<IEnumerable<ChatMessage>>(), Arg.Any<ChatOptions>(), Arg.Any<CancellationToken>())
            .Returns(_ => Working());
    }

    protected async Task Respond(bool streaming)
    {
        _error = await Catch.Exception(async () =>
        {
            if (streaming)
            {
                await foreach (var update in _client.GetStreamingResponseAsync([new(ChatRole.User, "act")], _chatOptions, _cancellation.Token)) _text += update.Text;
            }
            else
            {
                _text = (await _client.GetResponseAsync([new(ChatRole.User, "act")], _chatOptions, _cancellation.Token)).Text;
            }
        });
    }

    protected void SecondMemberWasNotCreated() => _factory.DidNotReceive().Create(Arg.Is<ConfiguredAIProvider>(provider => provider.Id == _second), Arg.Any<ModelName>());

    async Task<string> Act(CancellationToken cancellationToken)
    {
        using var resource = _functionResource;
        Interlocked.Increment(ref _attempts);
        if (_rateLimitDuringTool)
        {
            var shutdown = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            await using var registration = cancellationToken.Register(() => shutdown.TrySetResult());
            _toolStarted.TrySetResult();
            await shutdown.Task.WaitAsync(TimeSpan.FromSeconds(5));
            _toolDrained = true;
        }

        if (_failTool) throw new ClaudeCodeConversationFailed("private tool failure");
        return "effect completed";
    }

    async IAsyncEnumerable<string> RunChild(ProcessStartInfo info)
    {
        _startInfo = info;
        var (url, authorization) = await Connection(info);
        _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", authorization);
        yield return """{"type":"system","subtype":"init","mcp_servers":[{"name":"cratis","status":"connected"}]}""";
        if (_invokeTool)
        {
            var request = CallTool(url);
            if (_rateLimitDuringTool)
            {
                _pendingRequest = request;
                await _toolStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
            }
            else
            {
                using var response = await request;
                response.EnsureSuccessStatusCode();
                var result = await response.Content.ReadFromJsonAsync<JsonElement>();
                result.GetProperty("result").GetProperty("isError").GetBoolean().ShouldEqual(_failTool);
            }
        }

        if (_emitText)
        {
            yield return """{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"partial answer"}}}""";
        }

        if (_malformedOutput) yield return "{429 private diagnostic sentinel";
        if (_failDirectoryCleanup)
        {
            Directory.Delete(info.WorkingDirectory, recursive: true);
            await File.WriteAllTextAsync(info.WorkingDirectory, "cleanup obstruction");
        }

        if (_cancelAfterTool)
        {
            await _cancellation.CancelAsync();
            throw _cancelled;
        }

        if (_endWithoutResult || _malformedOutput || _failDirectoryCleanup) yield break;
        throw _transportError ?? _failure;
    }

    Task<HttpResponseMessage> CallTool(string url) =>
        _http.PostAsJsonAsync(url, new { jsonrpc = "2.0", id = 2, method = "tools/call", @params = new { name = "act", arguments = new { } } });

    async Task Destroy()
    {
        _cancellation.Dispose();
        if (_pendingRequest is not null)
        {
            // Server shutdown may close its pending response; observe the request before disposal.
            await Catch.Exception(async () => { using var response = await _pendingRequest; });
        }

        _http.Dispose();
        if (_failDirectoryCleanup && File.Exists(_startInfo.WorkingDirectory)) File.Delete(_startInfo.WorkingDirectory);
    }

    static async IAsyncEnumerable<ChatResponseUpdate> Working()
    {
        await Task.CompletedTask;
        yield return new(ChatRole.Assistant, "fallback");
    }
}

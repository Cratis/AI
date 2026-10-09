// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Cratis.AI.Agents;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// An <see cref="IChatClient"/> for a Claude subscription, built on the unmodified official Claude
/// Code CLI rather than the Messages API (which rejects a subscription's OAuth token outright). Every
/// call is one isolated CLI child in its own disposable temporary directory: history is replayed as a
/// transcript (see <see cref="ClaudeCodeTranscript"/>), any <see cref="ChatOptions.Tools"/> are exposed
/// to that one child through a fresh, per-call <see cref="ClaudeCodeMcpServer"/> so the model can call
/// them natively, and the final answer's text and usage are returned - never a fabricated
/// <see cref="FunctionCallContent"/>, because the tool loop already ran, inside the CLI, before this
/// method returns.
/// </summary>
/// <param name="process">Runs the isolated child and streams its output.</param>
/// <param name="credential">The revealed subscription token - passed only through the child environment, never an argument.</param>
/// <param name="modelId">The model to run every turn against.</param>
/// <param name="effort">The reasoning effort every turn runs with - <see cref="ChatOptions"/> carries no equivalent concept to read one from.</param>
public sealed class ClaudeCodeChatClient(IClaudeCodeStreamingProcess process, AIProviderApiKey credential, string modelId, Effort effort = Effort.High) : IChatClient
{
    /// <summary>
    /// Gets whether generic factory preferences are normalized to vendor defaults.
    /// </summary>
    internal bool UseVendorDefaults { get; init; }

    /// <inheritdoc/>
    public async Task<ChatResponse> GetResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, CancellationToken cancellationToken = default) =>
        await GetStreamingResponseAsync(messages, options, cancellationToken).ToChatResponseAsync(cancellationToken);

    /// <inheritdoc/>
    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(IEnumerable<ChatMessage> messages, ChatOptions? options = null, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var update in RunTurn(messages as IReadOnlyList<ChatMessage> ?? messages.ToList(), options, cancellationToken))
        {
            yield return update;
        }
    }

    /// <inheritdoc/>
    public object? GetService(Type serviceType, object? serviceKey = null) =>
        serviceKey is null && serviceType.IsInstanceOfType(this) ? this : null;

    /// <inheritdoc/>
    public void Dispose()
    {
        // Every resource this client opens (the child process, its temporary directory, the ephemeral
        // MCP listener) is scoped to a single call and already disposed before that call returns -
        // there is nothing left held across calls for this method to release.
    }

    static async Task<bool> MoveNext(IAsyncEnumerator<ChatResponseUpdate> updates, Func<bool> invocationAttempted, CancellationToken cancellationToken)
    {
        try
        {
            return await updates.MoveNextAsync();
        }
        catch (Exception exception) when (exception is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            // RunTurnCore has stopped admission and drained concurrent requests before this check.
            if (!invocationAttempted()) throw;
            if (exception is ClaudeCodeConversationFailed failure)
            {
                failure.FunctionInvocationAttempted = true;
                throw;
            }

            throw new ClaudeCodeConversationFailed("Claude Code failed after a caller function invocation attempt; its effects are unknown and the turn must not be replayed.", functionInvocationAttempted: true);
        }
    }

    async IAsyncEnumerable<ChatResponseUpdate> RunTurn(IReadOnlyList<ChatMessage> messages, ChatOptions? options, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var omittedControls = UseVendorDefaults ? ClaudeCodeChatOptions.OmittedControls(options) : [];
        if (UseVendorDefaults) options = ClaudeCodeChatOptions.WithVendorDefaults(options);
        ClaudeCodeChatOptions.Validate(options);
        var invocationAttempted = 0;
        await using var updates = RunTurnCore(messages, options, omittedControls, () => Interlocked.Exchange(ref invocationAttempted, 1), cancellationToken).GetAsyncEnumerator(cancellationToken);
        while (await MoveNext(updates, () => Volatile.Read(ref invocationAttempted) != 0, cancellationToken))
        {
            yield return updates.Current;
        }
    }

    async IAsyncEnumerable<ChatResponseUpdate> RunTurnCore(IReadOnlyList<ChatMessage> messages, ChatOptions? options, IReadOnlyList<string> omittedControls, Action invocationStarting, [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var tools = options?.ToolMode == ChatToolMode.None ? [] : options?.Tools?.OfType<AIFunction>().ToList() ?? [];

        // Drain tools before directory cleanup, even if cleanup fails.
        string? directory = null;
        try
        {
            var (systemPrompt, transcript) = ClaudeCodeTranscript.Build(messages, options?.Instructions);
            directory = Directory.CreateTempSubdirectory("cratis-ai-conversation-").FullName;
            await using var server = tools.Count > 0 ? new ClaudeCodeMcpServer(tools, cancellationToken: cancellationToken) { InvocationStarting = invocationStarting } : null;
            server?.Start();
            var startInfo = StartInfo(directory, credential, options?.ModelId ?? modelId, effort, systemPrompt, server);
            if (options?.ResponseFormat is ChatResponseFormatJson { Schema: { } schema })
            {
                startInfo.ArgumentList.Add("--json-schema");
                startInfo.ArgumentList.Add(schema.GetRawText());
            }

            string? responseId = null;
            ClaudeCodeStreamEvent? result = null;
            var streamedAnyText = false;
            var initialized = false;
            ChatFinishReason? stopReason = null;

            await foreach (var line in process.Run(startInfo, transcript, cancellationToken))
            {
                if (!ClaudeCodeStreamEvent.TryParse(line, out var parsed))
                {
                    continue;
                }

                if (parsed.IsInit)
                {
                    if (parsed.IsFailure || (server is not null && !parsed.ConnectedServers.Contains(server.ServerName)))
                    {
                        throw new ClaudeCodeConversationFailed("Claude Code could not connect to the invocation's tool server.");
                    }

                    initialized = true;
                    responseId = parsed.SessionId;
                    continue;
                }

                if (server is not null && !initialized)
                {
                    throw new ClaudeCodeConversationFailed("Claude Code did not confirm the invocation's tool server connection.");
                }

                if (parsed.IsFailure)
                {
                    throw new ClaudeCodeConversationFailed(parsed.FailureReason!, kind: parsed.FailureKind);
                }

                if (parsed.HasStopReason) stopReason = parsed.FinishReason;

                if (parsed.IsPartialText && options?.ResponseFormat is not ChatResponseFormatJson)
                {
                    streamedAnyText = true;
                    yield return new ChatResponseUpdate(ChatRole.Assistant, parsed.DeltaText) { ResponseId = responseId };
                    continue;
                }

                if (parsed.IsResult)
                {
                    result = parsed;
                }
            }

            if (result is null)
            {
                throw new ClaudeCodeConversationFailed("Claude Code ended without a result message. Check the configured subscription and model.");
            }

            if (result.IsFailure)
            {
                throw new ClaudeCodeConversationFailed(result.FailureReason!, kind: result.FailureKind);
            }

            if (options?.ResponseFormat is ChatResponseFormatJson && !result.HasStructuredOutput)
            {
                throw new ClaudeCodeConversationFailed("Claude Code did not return the requested schema-constrained output.");
            }

            // The streamed deltas are the normal path and already compose this text; the result's own
            // copy is used only as a fallback for a turn that produced no partial events at all (a very
            // short answer, or a run without --include-partial-messages taking effect).
            if (!streamedAnyText && !string.IsNullOrEmpty(result.ResultText))
            {
                yield return new ChatResponseUpdate(ChatRole.Assistant, result.ResultText) { ResponseId = responseId ?? result.SessionId };
            }

            var final = FinalUpdate(responseId ?? result.SessionId, result, options?.ModelId);
            if (!result.HasStopReason && stopReason is not null) final.FinishReason = stopReason;
            if (omittedControls.Count > 0)
            {
                final.AdditionalProperties ??= [];
                final.AdditionalProperties["vendor_controlled_options"] = omittedControls;
            }

            yield return final;
        }
        finally
        {
            if (directory is not null) Directory.Delete(directory, recursive: true);
        }
    }

    ChatResponseUpdate FinalUpdate(string? responseId, ClaudeCodeStreamEvent result, string? requestedModel)
    {
        var update = new ChatResponseUpdate(ChatRole.Assistant, [])
        {
            ResponseId = responseId,
            ModelId = result.ModelId ?? requestedModel ?? modelId,
            FinishReason = result.FinishReason,
        };

        if (result.Usage is { } usage)
        {
            update.Contents.Add(new UsageContent(usage));
        }

        if (result.CostUsd is { } cost)
        {
            update.AdditionalProperties ??= [];
            update.AdditionalProperties["cost_usd"] = cost;
        }

        return update;
    }

    /// <summary>
    /// Isolates the conversation from host credentials, repositories, settings, hooks and every
    /// built-in tool; the only tools the model can reach are the ones named in <paramref name="server"/>,
    /// exposed exclusively through <c>--strict-mcp-config</c> and pre-approved by name so a headless
    /// run never blocks on a permission prompt nobody can answer. Never passes <c>--dangerously-skip-permissions</c>:
    /// doing so would also grant the shell and file tools this configuration otherwise removes entirely.
    /// </summary>
    /// <param name="directory">The disposable, empty working directory.</param>
    /// <param name="credential">The subscription token.</param>
    /// <param name="modelId">The model to run the turn against.</param>
    /// <param name="effort">The requested reasoning effort.</param>
    /// <param name="systemPrompt">Text to append to the default system prompt, when the caller supplied any.</param>
    /// <param name="server">The ephemeral MCP server exposing this turn's tools, when it has any.</param>
    /// <returns>The isolated process configuration.</returns>
    /// <exception cref="ClaudeCodeConversationFailed">Owner-only file creation is unavailable.</exception>
    internal static ProcessStartInfo StartInfo(string directory, AIProviderApiKey credential, string modelId, Effort effort, string? systemPrompt, ClaudeCodeMcpServer? server)
    {
        var info = new ProcessStartInfo("claude")
        {
            WorkingDirectory = directory,
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };
        info.Environment.Clear();
        info.Environment["PATH"] = Environment.GetEnvironmentVariable("PATH");
        info.Environment["HOME"] = directory;
        info.Environment["CLAUDE_CONFIG_DIR"] = Path.Combine(directory, ".claude");
        info.Environment["CLAUDE_CODE_OAUTH_TOKEN"] = AnthropicCredential.Normalize(credential).Value;
        info.Environment["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "1";

        var mcpConfig = server is null
            ? "{\"mcpServers\":{}}"
            : JsonSerializer.Serialize(new { mcpServers = new Dictionary<string, object> { [server.ServerName] = new { type = "http", url = server.Endpoint.ToString(), headers = new Dictionary<string, string> { ["Authorization"] = server.Authorization } } } });
        var configPath = Path.Combine(directory, "mcp.json");

        // Refuse platforms without the owner-only file creation mechanism this transport uses.
        if (OperatingSystem.IsWindows()) throw new ClaudeCodeConversationFailed("Claude Code chat currently requires Unix owner-only temporary files.");
        using (var file = new FileStream(configPath, new FileStreamOptions
        {
            Mode = FileMode.CreateNew,
            Access = FileAccess.Write,
            UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite,
        }))
        {
            file.Write(System.Text.Encoding.UTF8.GetBytes(mcpConfig));
        }

        List<string> arguments =
        [
            "-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
            "--model", modelId,
            "--effort", ClaudeCodeEffort.Arg(effort),
            "--tools", string.Empty,
            "--strict-mcp-config", "--mcp-config", configPath,
        ];

        if (server is not null)
        {
            // Pre-approved by name, and by name only: no other tool - built-in or from any other MCP
            // server - exists in this session for a broader rule to accidentally cover.
            arguments.Add("--allowedTools");
            arguments.Add($"mcp__{server.ServerName}__*");
        }

        arguments.AddRange([
            "--permission-prompts", "none",
            "--disable-slash-commands", "--no-session-persistence", "--setting-sources", string.Empty,
            "--settings", "{\"disableAllHooks\":true}",
        ]);

        if (!string.IsNullOrWhiteSpace(systemPrompt))
        {
            arguments.Add("--append-system-prompt");
            arguments.Add(systemPrompt);
        }

        foreach (var argument in arguments)
        {
            info.ArgumentList.Add(argument);
        }

        return info;
    }
}

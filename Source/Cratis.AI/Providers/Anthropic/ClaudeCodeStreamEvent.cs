// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Parses CLI startup connectivity, primary text deltas, stop reasons, results and structured
/// model failures. Tool bookkeeping and thinking deltas are not forwarded as answer text.
/// </summary>
internal sealed record ClaudeCodeStreamEvent
{
    /// <summary>
    /// Gets a value indicating whether this is the session-startup event.
    /// </summary>
    internal bool IsInit { get; private init; }

    /// <summary>
    /// Gets the server names the CLI confirmed connected.
    /// </summary>
    internal IReadOnlyList<string> ConnectedServers { get; private init; } = [];

    /// <summary>
    /// Gets the reported terminal reason.
    /// </summary>
    internal ChatFinishReason FinishReason { get; private init; } = ChatFinishReason.Stop;

    /// <summary>
    /// Gets whether the result carries schema-constrained output.
    /// </summary>
    internal bool HasStructuredOutput { get; private init; }

    /// <summary>
    /// Gets whether the event reports a stop reason.
    /// </summary>
    internal bool HasStopReason { get; private init; }

    /// <summary>
    /// Gets a value indicating whether this is a streamed assistant text delta.
    /// </summary>
    internal bool IsPartialText { get; private init; }

    /// <summary>
    /// Gets a value indicating whether this is the terminal result event.
    /// </summary>
    internal bool IsResult { get; private init; }

    /// <summary>
    /// Gets a value indicating whether the event represents a failure - either the terminal result
    /// reported one, or (for <see cref="IsInit"/>) the MCP server never connected.
    /// </summary>
    internal bool IsFailure { get; private init; }

    /// <summary>
    /// Gets the diagnostic-free failure classification.
    /// </summary>
    internal ClaudeCodeFailureKind FailureKind { get; private init; }

    /// <summary>
    /// Gets the Claude Code session id, when the event carried one.
    /// </summary>
    internal string? SessionId { get; private init; }

    /// <summary>
    /// Gets the streamed text, for <see cref="IsPartialText"/>.
    /// </summary>
    internal string? DeltaText { get; private init; }

    /// <summary>
    /// Gets why the conversation failed, for <see cref="IsFailure"/>.
    /// </summary>
    internal string? FailureReason { get; private init; }

    /// <summary>
    /// Gets the model that actually produced the result, for <see cref="IsResult"/>.
    /// </summary>
    internal string? ModelId { get; private init; }

    /// <summary>
    /// Gets the final answer text the result envelope itself carried, for <see cref="IsResult"/>. Used
    /// only as a fallback when no <see cref="IsPartialText"/> event ever arrived - the normal path is
    /// the streamed deltas, which arrive before this and already compose the same text.
    /// </summary>
    internal string? ResultText { get; private init; }

    /// <summary>
    /// Gets the measured usage, for <see cref="IsResult"/>.
    /// </summary>
    internal UsageDetails? Usage { get; private init; }

    /// <summary>
    /// Gets the reported cost in USD, for <see cref="IsResult"/>.
    /// </summary>
    internal decimal? CostUsd { get; private init; }

    /// <summary>
    /// Attempts to parse one output line into a recognized event.
    /// </summary>
    /// <param name="line">The raw line.</param>
    /// <param name="parsed">The parsed event, when recognized.</param>
    /// <returns><see langword="true"/> when the line was a recognized, well-formed event.</returns>
    internal static bool TryParse(string line, out ClaudeCodeStreamEvent parsed)
    {
        parsed = null!;
        try
        {
            using var document = JsonDocument.Parse(line);
            var body = document.RootElement;
            if (body.ValueKind != JsonValueKind.Object || !body.TryGetProperty("type", out var typeElement))
            {
                return false;
            }

            var candidate = typeElement.GetString() switch
            {
                "system" => ParseInit(body),
                "stream_event" => ParsePartialText(body),
                "result" => ParseResult(body),
                "assistant" when body.TryGetProperty("error", out var error) && error.ValueKind != JsonValueKind.Null =>
                    error.ValueKind == JsonValueKind.String && error.GetString() == "rate_limit"
                        ? Failure("Claude Code's model request was rate limited (HTTP 429).", ClaudeCodeFailureKind.RateLimit)
                        : Failure("Claude Code's model request failed.", ClaudeCodeFailureKind.ModelRequest),
                "assistant" when body.TryGetProperty("message", out var message) && message.ValueKind == JsonValueKind.Object => ParseFinish(message),
                "rate_limit_event" when body.TryGetProperty("rate_limit_info", out var limit) && limit.ValueKind == JsonValueKind.Object &&
                    limit.TryGetProperty("status", out var status) && status.ValueKind == JsonValueKind.String && status.GetString() == "rejected" => Failure("Claude Code's model request was rate limited (HTTP 429).", ClaudeCodeFailureKind.RateLimit),
                _ => null,
            };

            if (candidate is null)
            {
                return false;
            }

            parsed = candidate;
            return true;
        }
        catch (Exception exception) when (exception is JsonException or InvalidOperationException or FormatException)
        {
            return false;
        }
    }

    static ClaudeCodeStreamEvent Failure(string message, ClaudeCodeFailureKind kind) => new() { IsFailure = true, FailureReason = message, FailureKind = kind };

    static ClaudeCodeStreamEvent? ParseInit(JsonElement body)
    {
        if (!body.TryGetProperty("subtype", out var subtype) || subtype.GetString() != "init")
        {
            return null;
        }

        var sessionId = body.TryGetProperty("session_id", out var sessionElement) ? sessionElement.GetString() : null;

        if (body.TryGetProperty("mcp_server_errors", out var errors) &&
            ((errors.ValueKind == JsonValueKind.Array && errors.GetArrayLength() > 0) ||
             (errors.ValueKind == JsonValueKind.Object && errors.EnumerateObject().Any())))
        {
            return new ClaudeCodeStreamEvent
            {
                IsInit = true,
                IsFailure = true,
                SessionId = sessionId,
                FailureReason = "Claude Code could not reach the local tool server.",
            };
        }

        var connected = body.TryGetProperty("mcp_servers", out var servers) && servers.ValueKind == JsonValueKind.Array
            ? servers.EnumerateArray().Where(server => server.ValueKind == JsonValueKind.Object &&
                server.TryGetProperty("status", out var status) && status.ValueKind == JsonValueKind.String && status.GetString() == "connected" &&
                server.TryGetProperty("name", out var name) && name.ValueKind == JsonValueKind.String)
                .Select(server => server.GetProperty("name").GetString()!).ToArray()
            : [];
        return new ClaudeCodeStreamEvent { IsInit = true, SessionId = sessionId, ConnectedServers = connected };
    }

    static ClaudeCodeStreamEvent? ParsePartialText(JsonElement body)
    {
        if (body.TryGetProperty("parent_tool_use_id", out var parentToolUse) && parentToolUse.ValueKind == JsonValueKind.String)
        {
            // A subagent's own stream, not the primary answer - forwarding it would require
            // --forward-subagent-text, which this transport does not request.
            return null;
        }

        if (!body.TryGetProperty("event", out var streamEvent) || streamEvent.ValueKind != JsonValueKind.Object ||
            !streamEvent.TryGetProperty("delta", out var delta) || delta.ValueKind != JsonValueKind.Object ||
            !delta.TryGetProperty("type", out var deltaType) || deltaType.GetString() != "text_delta")
        {
            return body.TryGetProperty("event", out var ending) && ending.ValueKind == JsonValueKind.Object &&
                ending.TryGetProperty("delta", out var endingDelta) && endingDelta.ValueKind == JsonValueKind.Object ? ParseFinish(endingDelta) : null;
        }

        var text = delta.TryGetProperty("text", out var textElement) && textElement.ValueKind == JsonValueKind.String ? textElement.GetString() : null;
        return string.IsNullOrEmpty(text) ? null : new ClaudeCodeStreamEvent { IsPartialText = true, DeltaText = text };
    }

    static ClaudeCodeStreamEvent? ParseFinish(JsonElement body) =>
        body.TryGetProperty("stop_reason", out var reason) && reason.ValueKind == JsonValueKind.String
            ? new ClaudeCodeStreamEvent { HasStopReason = true, FinishReason = FinishReasonFor(reason.GetString()) }
            : null;

    static ChatFinishReason FinishReasonFor(string? reason) => reason switch
    {
        "max_tokens" => ChatFinishReason.Length,
        "tool_use" => ChatFinishReason.ToolCalls,
        "refusal" => ChatFinishReason.ContentFilter,
        _ => ChatFinishReason.Stop,
    };

    static ClaudeCodeStreamEvent ParseResult(JsonElement body)
    {
        var reportedError = body.TryGetProperty("is_error", out var errorElement) && errorElement.ValueKind != JsonValueKind.False;
        var succeededSubtype = body.TryGetProperty("subtype", out var subtype) && subtype.ValueKind == JsonValueKind.String && subtype.GetString() == "success";
        var hasResultText = body.TryGetProperty("result", out var resultElement) && resultElement.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(resultElement.GetString());
        var hasStructuredOutput = body.TryGetProperty("structured_output", out var structured) && structured.ValueKind == JsonValueKind.Object;
        var succeeded = !reportedError && succeededSubtype && (hasResultText || hasStructuredOutput);

        string? failureReason = null;
        if (!succeeded)
        {
            failureReason = body.TryGetProperty("api_error_status", out var status) && status.ValueKind == JsonValueKind.Number && status.GetInt32() is var code && (code == 429 || code >= 500)
                ? $"Claude Code's model request returned HTTP {code}"
                : "Claude Code did not complete the conversation. Check the configured subscription and model.";
        }

        var modelId = body.TryGetProperty("modelUsage", out var modelUsage) && modelUsage.ValueKind == JsonValueKind.Object
            ? modelUsage.EnumerateObject().Select(property => property.Name).FirstOrDefault()
            : null;

        var usage = ClaudeCodeUsage.Read(body);
        var reason = body.TryGetProperty("stop_reason", out var stop) && stop.ValueKind == JsonValueKind.String ? stop.GetString() : null;

        return new ClaudeCodeStreamEvent
        {
            IsResult = true,
            IsFailure = !succeeded,
            FailureReason = failureReason,
            FailureKind = body.TryGetProperty("api_error_status", out var apiStatus) && apiStatus.ValueKind == JsonValueKind.Number && apiStatus.TryGetInt32(out var apiCode) && apiCode == 429
                ? ClaudeCodeFailureKind.RateLimit : ClaudeCodeFailureKind.Conversation,
            SessionId = body.TryGetProperty("session_id", out var sessionElement) ? sessionElement.GetString() : null,
            ResultText = hasStructuredOutput ? structured.GetRawText() : hasResultText ? resultElement.GetString() : null,
            HasStructuredOutput = hasStructuredOutput,
            FinishReason = FinishReasonFor(reason),
            HasStopReason = reason is not null,
            ModelId = modelId,
            Usage = usage,
            CostUsd = ClaudeCodeUsage.CostUsd(body),
        };
    }
}

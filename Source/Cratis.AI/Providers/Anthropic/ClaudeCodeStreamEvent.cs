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
    /// Gets the vendor's own failure code (such as <c>authentication_failed</c>) when it is one this transport
    /// recognizes or a short identifier-shaped token, for a failure; never free vendor text.
    /// </summary>
    internal string? FailureCode { get; private init; }

    /// <summary>
    /// Gets whether the line only announced that the CLI is retrying a failed API call.
    /// </summary>
    internal bool IsRetry { get; private init; }

    /// <summary>
    /// Gets the HTTP status the vendor answered with, for <see cref="IsRetry"/> and a result failure.
    /// </summary>
    internal int? HttpStatus { get; private init; }

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

            var candidate = ParseEvent(typeElement.GetString(), body);

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

    static ClaudeCodeStreamEvent? ParseEvent(string? type, JsonElement body) => type switch
    {
        "system" => IsApiRetry(body) ? ParseApiRetry(body) : ParseInit(body),
        "stream_event" => ParsePartialText(body),
        "result" => ParseResult(body),
        "assistant" => ParseAssistant(body),
        "rate_limit_event" => ParseRateLimit(body),
        _ => null,
    };

    static ClaudeCodeStreamEvent? ParseAssistant(JsonElement body)
    {
        if (body.TryGetProperty("error", out var error) && error.ValueKind != JsonValueKind.Null)
        {
            return ParseAssistantError(body, error);
        }

        return TryGetObject(body, "message", out var message) ? ParseFinish(message) : null;
    }

    static ClaudeCodeStreamEvent? ParseRateLimit(JsonElement body) =>
        TryGetObject(body, "rate_limit_info", out var limit) && ReadString(limit, "status") == "rejected"
            ? new ClaudeCodeStreamEvent { IsFailure = true, FailureReason = "Claude Code's model request was rate limited (HTTP 429).", FailureKind = ClaudeCodeFailureKind.RateLimit }
            : null;

    static bool TryGetObject(JsonElement body, string name, out JsonElement value) =>
        body.TryGetProperty(name, out value) && value.ValueKind == JsonValueKind.Object;

    static bool TryGetArray(JsonElement body, string name, out JsonElement value) =>
        body.TryGetProperty(name, out value) && value.ValueKind == JsonValueKind.Array;

    static string? ReadString(JsonElement body, string name) =>
        body.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;

    static bool IsApiRetry(JsonElement body) =>
        body.TryGetProperty("subtype", out var subtype) && subtype.ValueKind == JsonValueKind.String && subtype.GetString() == "api_retry";

    static ClaudeCodeStreamEvent ParseApiRetry(JsonElement body) => new()
    {
        IsRetry = true,
        HttpStatus = body.TryGetProperty("error_status", out var status) && status.ValueKind == JsonValueKind.Number && status.TryGetInt32(out var code) ? code : null,
    };

    // The CLI names what went wrong on the assistant message's error field, and carries the vendor's API error in the
    // message's text ("API Error: 400 {...}"). The code is read as an identifier. Of the text only the vendor's own
    // error message inside that JSON, or the CLI's own wording of a failure, is kept - a short, credential-free excerpt - so
    // the person can see what it objected to; any other text is not trusted to be safe and is dropped.
    static ClaudeCodeStreamEvent ParseAssistantError(JsonElement body, JsonElement error)
    {
        var code = error.ValueKind == JsonValueKind.String ? ClaudeCodeFailureText.SafeCode(error.GetString()) : null;
        var kind = ClaudeCodeFailureText.KindOf(code);
        var detail = ClaudeCodeFailureText.Excerpt(AssistantText(body));
        return new ClaudeCodeStreamEvent
        {
            IsFailure = true,
            FailureKind = kind,
            FailureCode = code,
            FailureReason = ClaudeCodeFailureText.For(kind, code, null, detail),
        };
    }

    static string? AssistantText(JsonElement body)
    {
        if (!TryGetObject(body, "message", out var message) || !TryGetArray(message, "content", out var content))
        {
            return null;
        }

        // The CLI words some failures itself, as a message from its own "<synthetic>" model ("There's an issue with the
        // selected model ..."): that text is the CLI's, not the model's and not the user's, so it is safe to excerpt.
        var synthetic = ReadString(message, "model") == "<synthetic>";
        return content.EnumerateArray()
            .Where(part => part.ValueKind == JsonValueKind.Object)
            .Select(part => AssistantErrorDetail(ReadString(part, "text"), synthetic))
            .FirstOrDefault(detail => detail is not null);
    }

    static string? AssistantErrorDetail(string? text, bool synthetic)
    {
        if (VendorMessageIn(text) is { } vendorMessage) return vendorMessage;
        return synthetic && !string.IsNullOrWhiteSpace(text) ? text : null;
    }

    // The vendor's error message from the API error body the CLI echoes after its own "API Error: <status>" prefix.
    static string? VendorMessageIn(string? text)
    {
        var start = text?.IndexOf('{', StringComparison.Ordinal) ?? -1;
        if (text is null || start < 0)
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(text[start..]);
            var root = document.RootElement;
            return VendorErrorMessage(root);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    static string? VendorErrorMessage(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object) return null;
        var holder = TryGetObject(root, "error", out var error) ? error : root;
        return ReadString(holder, "message");
    }

    static bool HasServerErrors(JsonElement body) =>
        body.TryGetProperty("mcp_server_errors", out var errors) && errors.ValueKind switch
        {
            JsonValueKind.Array => errors.GetArrayLength() > 0,
            JsonValueKind.Object => errors.EnumerateObject().Any(),
            _ => false,
        };

    static bool IsConnectedServer(JsonElement server) =>
        server.ValueKind == JsonValueKind.Object && HasConnectedIdentity(server);

    static bool HasConnectedIdentity(JsonElement server) =>
        ReadString(server, "status") == "connected" && ReadString(server, "name") is not null;

    static string[] ConnectedServerNames(JsonElement body) =>
        TryGetArray(body, "mcp_servers", out var servers)
            ? servers.EnumerateArray().Where(IsConnectedServer).Select(server => server.GetProperty("name").GetString()!).ToArray()
            : [];

    static ClaudeCodeStreamEvent? ParseInit(JsonElement body)
    {
        if (!body.TryGetProperty("subtype", out var subtype) || subtype.GetString() != "init")
        {
            return null;
        }

        var sessionId = body.TryGetProperty("session_id", out var sessionElement) ? sessionElement.GetString() : null;

        if (HasServerErrors(body))
        {
            return new ClaudeCodeStreamEvent
            {
                IsInit = true,
                IsFailure = true,
                SessionId = sessionId,
                FailureReason = "Claude Code could not reach the local tool server.",
            };
        }

        return new ClaudeCodeStreamEvent { IsInit = true, SessionId = sessionId, ConnectedServers = ConnectedServerNames(body) };
    }

    static bool TryGetDelta(JsonElement body, out JsonElement delta)
    {
        delta = default;
        return TryGetObject(body, "event", out var streamEvent) && TryGetObject(streamEvent, "delta", out delta);
    }

    static bool IsTextDelta(JsonElement delta) =>
        delta.TryGetProperty("type", out var type) && type.GetString() == "text_delta";

    static ClaudeCodeStreamEvent? ParsePartialText(JsonElement body)
    {
        if (body.TryGetProperty("parent_tool_use_id", out var parentToolUse) && parentToolUse.ValueKind == JsonValueKind.String)
        {
            // A subagent's own stream, not the primary answer - forwarding it would require
            // --forward-subagent-text, which this transport does not request.
            return null;
        }

        if (!TryGetDelta(body, out var delta)) return null;
        if (!IsTextDelta(delta)) return ParseFinish(delta);

        var text = ReadString(delta, "text");
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

    static bool HasResultText(JsonElement body, out JsonElement result) =>
        body.TryGetProperty("result", out result) && result.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(result.GetString());

    static int? ReadErrorStatus(JsonElement body) =>
        body.TryGetProperty("api_error_status", out var status) && status.ValueKind == JsonValueKind.Number && status.TryGetInt32(out var code) ? code : null;

    static string ResultFailureReason(int? status, ClaudeCodeFailureKind kind, string? text) =>
        status is not null
            ? ClaudeCodeFailureText.For(kind, null, status, ClaudeCodeFailureText.Excerpt(text))
            : "Claude Code did not complete the conversation. Check the configured subscription and model.";

    static string? ResultModelId(JsonElement body) =>
        body.TryGetProperty("modelUsage", out var modelUsage) && modelUsage.ValueKind == JsonValueKind.Object
            ? modelUsage.EnumerateObject().Select(property => property.Name).FirstOrDefault()
            : null;

    static bool ReportedError(JsonElement body) =>
        body.TryGetProperty("is_error", out var error) && error.ValueKind != JsonValueKind.False;

    static bool SucceededSubtype(JsonElement body) =>
        body.TryGetProperty("subtype", out var subtype) && subtype.ValueKind == JsonValueKind.String && subtype.GetString() == "success";

    static ResultContent ReadResultContent(JsonElement body)
    {
        var reportedError = ReportedError(body);
        var succeededSubtype = SucceededSubtype(body);
        var hasText = HasResultText(body, out var text);
        var hasStructuredOutput = body.TryGetProperty("structured_output", out var structured) && structured.ValueKind == JsonValueKind.Object;
        var succeeded = !reportedError && succeededSubtype && (hasText || hasStructuredOutput);
        var failureText = hasText ? text.GetString() : null;
        return new(succeeded, hasStructuredOutput, hasStructuredOutput ? structured.GetRawText() : failureText, failureText);
    }

    static ClaudeCodeStreamEvent ParseResult(JsonElement body)
    {
        var content = ReadResultContent(body);
        var httpStatus = ReadErrorStatus(body);
        var failureKind = ClaudeCodeFailureText.KindOfStatus(httpStatus);
        var failureReason = content.Succeeded ? null : ResultFailureReason(httpStatus, failureKind, content.FailureText);

        var modelId = ResultModelId(body);

        var usage = ClaudeCodeUsage.Read(body);
        var reason = body.TryGetProperty("stop_reason", out var stop) && stop.ValueKind == JsonValueKind.String ? stop.GetString() : null;

        return new ClaudeCodeStreamEvent
        {
            IsResult = true,
            IsFailure = !content.Succeeded,
            FailureReason = failureReason,
            FailureKind = failureKind,
            HttpStatus = httpStatus,
            SessionId = body.TryGetProperty("session_id", out var sessionElement) ? sessionElement.GetString() : null,
            ResultText = content.Text,
            HasStructuredOutput = content.IsStructured,
            FinishReason = FinishReasonFor(reason),
            HasStopReason = reason is not null,
            ModelId = modelId,
            Usage = usage,
            CostUsd = ClaudeCodeUsage.CostUsd(body),
        };
    }

    sealed record ResultContent(bool Succeeded, bool IsStructured, string? Text, string? FailureText);
}

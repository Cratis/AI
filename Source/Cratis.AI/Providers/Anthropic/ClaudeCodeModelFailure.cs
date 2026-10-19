// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using System.Text.RegularExpressions;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Reads only allowlisted assistant error fields, never forwarding raw vendor diagnostics.
/// </summary>
internal static partial class ClaudeCodeModelFailure
{
    /// <summary>
    /// Describes a model refusal with bounded, redacted API details.
    /// </summary>
    /// <param name="body">The assistant envelope.</param>
    /// <param name="error">The error code.</param>
    /// <returns>The safe reason and classification.</returns>
    internal static (string Reason, ClaudeCodeFailureKind Kind) Read(JsonElement body, JsonElement error)
    {
        var value = error.ValueKind == JsonValueKind.String ? error.GetString()! : string.Empty;
        var code = value.Length is > 0 and <= 40 && value.All(character => character is >= 'a' and <= 'z' or '_') ? Redact(value) : "unknown";
        var (kind, hint) = code switch
        {
            "authentication_failed" => (ClaudeCodeFailureKind.Authentication, "the subscription credential was rejected; sign in again"),
            "billing_error" => (ClaudeCodeFailureKind.Billing, "the plan or credit is exhausted"),
            "invalid_request" => (ClaudeCodeFailureKind.InvalidRequest, "the request or model was refused"),
            "server_error" => (ClaudeCodeFailureKind.ServerError, "the vendor is temporarily unavailable"),
            _ => (ClaudeCodeFailureKind.ModelRequest, "an unknown model request error occurred"),
        };
        var (status, detail) = ReadApiError(body);
        var http = status.Length > 0 ? $" (HTTP {status})" : string.Empty;
        var description = detail.Length > 0 ? $": {detail}" : string.Empty;
        return ($"Claude Code's model request was refused: {code}{http}; {hint}{description}.", kind);
    }

    static (string Status, string Detail) ReadApiError(JsonElement body)
    {
        if (!body.TryGetProperty("message", out var message) || message.ValueKind != JsonValueKind.Object ||
            !message.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
        {
            return (string.Empty, string.Empty);
        }

        try
        {
            var text = content.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.Object && Text(item, "type") == "text")
                .Select(item => ApiError().Match(Text(item, "text")))
                .FirstOrDefault(match => match.Success);
            return text is null ? (string.Empty, string.Empty) : (text.Groups["status"].Value, ReadDetail(text.Groups["body"].Value));
        }
        catch (RegexMatchTimeoutException)
        {
            return (string.Empty, string.Empty);
        }
    }

    static string ReadDetail(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object ||
                !document.RootElement.TryGetProperty("error", out var error) || error.ValueKind != JsonValueKind.Object)
            {
                return string.Empty;
            }

            var detail = Redact(string.Join(": ", new[] { Text(error, "type"), Text(error, "message") }.Where(value => !string.IsNullOrWhiteSpace(value))));
            return detail.Length > 200 ? $"{detail[..197]}..." : detail;
        }
        catch (Exception exception) when (exception is JsonException or RegexMatchTimeoutException)
        {
            // Unreadable diagnostics are not safe to echo; the status and code still explain the refusal.
            return string.Empty;
        }
    }

    static string Text(JsonElement body, string name) =>
        body.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString()! : string.Empty;

    static string Redact(string value) => Whitespace().Replace(NonPrintable().Replace(VendorErrorBody.Redact(value), " "), " ").Trim();

    [GeneratedRegex(@"\AAPI Error:\s*(?<status>[1-5][0-9]{2})(?:\s+(?<body>.*))?\z", RegexOptions.CultureInvariant | RegexOptions.Singleline, 100)]
    private static partial Regex ApiError();

    [GeneratedRegex(@"[^\x20-\x7e]", RegexOptions.CultureInvariant, 100)]
    private static partial Regex NonPrintable();

    [GeneratedRegex(@"\s+", RegexOptions.CultureInvariant, 100)]
    private static partial Regex Whitespace();
}

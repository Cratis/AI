// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Turns the safe facts a Claude Code failure carries - the vendor's failure code and the HTTP status - into
/// a message somebody can act on, without ever repeating the vendor's free text.
/// </summary>
internal static class ClaudeCodeFailureText
{
    const int MaxCodeLength = 40;
    const int MaxExcerptLength = 300;

    /// <summary>
    /// Keeps a vendor failure code only when it is identifier-shaped, so nothing but a short lowercase token can reach a message.
    /// </summary>
    /// <param name="code">The code the CLI reported.</param>
    /// <returns>The code, or <see langword="null"/> when it is absent or not identifier-shaped.</returns>
    internal static string? SafeCode(string? code) =>
        !string.IsNullOrEmpty(code) && code.Length <= MaxCodeLength && code.All(character => character is (>= 'a' and <= 'z') or '_')
            ? code
            : null;

    /// <summary>
    /// Classifies a vendor failure code.
    /// </summary>
    /// <param name="code">The safe failure code.</param>
    /// <returns>The failure kind.</returns>
    internal static ClaudeCodeFailureKind KindOf(string? code) => code switch
    {
        "rate_limit" => ClaudeCodeFailureKind.RateLimit,
        "authentication_failed" or "oauth_org_not_allowed" => ClaudeCodeFailureKind.Authentication,
        "billing_error" => ClaudeCodeFailureKind.Billing,
        "invalid_request" => ClaudeCodeFailureKind.InvalidRequest,
        "server_error" => ClaudeCodeFailureKind.ServerError,
        _ => ClaudeCodeFailureKind.ModelRequest,
    };

    /// <summary>
    /// Classifies a vendor failure by the HTTP status it answered with.
    /// </summary>
    /// <param name="status">The HTTP status, when known.</param>
    /// <returns>The failure kind; <see cref="ClaudeCodeFailureKind.Conversation"/> when the status says nothing specific.</returns>
    internal static ClaudeCodeFailureKind KindOfStatus(int? status) => status switch
    {
        429 => ClaudeCodeFailureKind.RateLimit,
        401 or 403 => ClaudeCodeFailureKind.Authentication,
        402 => ClaudeCodeFailureKind.Billing,
        400 or 404 => ClaudeCodeFailureKind.InvalidRequest,
        >= 500 => ClaudeCodeFailureKind.ServerError,
        _ => ClaudeCodeFailureKind.Conversation,
    };

    /// <summary>
    /// Keeps a short excerpt of what the vendor said about a failure - credential patterns removed, whitespace
    /// collapsed, and bounded - so the person can see what it objected to without the text being able to carry a secret.
    /// </summary>
    /// <param name="text">What the vendor said, when it said anything.</param>
    /// <returns>The excerpt, or <see langword="null"/> when there is nothing to keep.</returns>
    internal static string? Excerpt(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var collapsed = string.Join(' ', VendorErrorBody.Redact(text).Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)).Replace('"', '\'');
        return collapsed.Length <= MaxExcerptLength ? collapsed : $"{collapsed[..MaxExcerptLength]}…";
    }

    /// <summary>
    /// Describes a failure.
    /// </summary>
    /// <param name="kind">The classification.</param>
    /// <param name="code">The safe vendor code, when there is one.</param>
    /// <param name="status">The HTTP status the vendor answered with, when known.</param>
    /// <param name="detail">A short credential-free excerpt of what the vendor said, when there is one - see <see cref="Excerpt"/>.</param>
    /// <returns>The message.</returns>
    internal static string For(ClaudeCodeFailureKind kind, string? code, int? status, string? detail = null)
    {
        var facts = (code, status) switch
        {
            (not null, not null) => $" ({code}, HTTP {status})",
            (not null, null) => $" ({code})",
            (null, not null) => $" (HTTP {status})",
            _ => string.Empty
        };

        var said = string.IsNullOrEmpty(detail) ? string.Empty : $" The vendor said: \"{detail}\"";
        return kind switch
        {
            ClaudeCodeFailureKind.Authentication => $"Claude Code's model request was not authorized{facts}: the subscription token was rejected as invalid, expired or revoked. Create a new one and reconnect the provider.{said}",
            ClaudeCodeFailureKind.Billing => $"Claude Code's model request was refused{facts}: the account is out of credit or its plan does not cover this use.{said}",
            ClaudeCodeFailureKind.InvalidRequest => $"Claude Code's model request was rejected as invalid{facts}: the account may not be able to use the model this agent's tier maps to, or the request itself was refused.{said}",
            ClaudeCodeFailureKind.ServerError => $"Claude Code's model request failed on the vendor's side{facts}; trying again later may work.{said}",
            ClaudeCodeFailureKind.RateLimit => "Claude Code's model request was rate limited (HTTP 429).",
            _ => $"Claude Code's model request failed{facts}.{said}",
        };
    }
}

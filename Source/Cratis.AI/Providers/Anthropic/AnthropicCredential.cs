// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Tells the two kinds of Anthropic credential apart, because they authenticate through entirely
/// different mechanisms and sending one the other's way is rejected with an HTTP 401 that names
/// neither. Ported from Direct's <c>AIProviders.Anthropic.AnthropicCredential</c> (plan Section 5.2
/// step 3).
/// <list type="bullet">
/// <item>
/// An <b>API key</b> (<c>sk-ant-api…</c>) is created in the Anthropic Console, billed per token, and
/// travels as the <c>x-api-key</c> header (or the vendor-standard <c>ANTHROPIC_API_KEY</c> variable
/// the CLIs read).
/// </item>
/// <item>
/// An <b>OAuth token</b> (<c>sk-ant-oat…</c>) is what <c>claude setup-token</c> mints against a
/// Claude subscription for headless use. It is a bearer token: it travels as
/// <c>Authorization: Bearer</c> alongside the <c>anthropic-beta: oauth-2025-04-20</c> header, and the
/// Claude Code CLI reads it from <c>CLAUDE_CODE_OAUTH_TOKEN</c> rather than
/// <c>ANTHROPIC_API_KEY</c>.
/// </item>
/// </list>
/// Both are pasted into the same "API key" field in a provider's configuration, look alike at a
/// glance, and only differ by this prefix - so the distinction is drawn here once rather than
/// guessed at each call site. Handing an OAuth token over as an API key is what made every worker
/// session and every chat completion fail authentication in the donor deployment (issue #103).
/// </summary>
public static class AnthropicCredential
{
    /// <summary>
    /// The prefix Anthropic gives the OAuth access tokens <c>claude setup-token</c> mints -
    /// <c>oat</c> for "OAuth access token", against <c>api</c> for a Console-issued API key.
    /// </summary>
    const string OAuthTokenPrefix = "sk-ant-oat";

    /// <summary>
    /// Whether the credential is an OAuth token rather than an API key.
    /// </summary>
    /// <param name="apiKey">The stored credential, already revealed.</param>
    /// <returns><see langword="true"/> when it is an OAuth token.</returns>
    public static bool IsOAuthToken(AIProviderApiKey apiKey) =>
        Normalize(apiKey).Value.StartsWith(OAuthTokenPrefix, StringComparison.Ordinal);

    /// <summary>
    /// Gets the HTTP headers required by the configured Anthropic credential.
    /// </summary>
    /// <param name="apiKey">The configured credential.</param>
    /// <returns>The authentication headers to send to Anthropic.</returns>
    public static IReadOnlyList<KeyValuePair<string, string>> HeadersFor(AIProviderApiKey apiKey)
    {
        var credential = Normalize(apiKey);
        return IsOAuthToken(credential)
            ?
            [
                new("Authorization", $"Bearer {credential.Value}"),
                new("anthropic-beta", "oauth-2025-04-20"),
            ]
            : [new("x-api-key", credential.Value)];
    }

    /// <summary>
    /// Removes whitespace introduced when an Anthropic credential is copied from wrapped terminal
    /// output. Anthropic keys and OAuth tokens contain no whitespace; call this after revealing a
    /// protected credential, never on ciphertext or on another provider's credential format.
    /// </summary>
    /// <param name="apiKey">The revealed Anthropic credential.</param>
    /// <returns>The credential without pasted whitespace, suitable for HTTP headers or worker secrets.</returns>
    public static AIProviderApiKey Normalize(AIProviderApiKey apiKey) =>
        new string([.. apiKey.Value.Where(character => !char.IsWhiteSpace(character))]);
}

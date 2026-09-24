// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using System.Text.Json.Nodes;

namespace Cratis.AI.Providers.Copilot;

/// <summary>
/// Tells the two shapes a GitHub Copilot credential arrives in apart, and answers the one question
/// every caller actually has: what bearer token do I send, and is there one at all.
/// <list type="bullet">
/// <item>
/// A <b>bare GitHub token</b> - what GitHub's device flow hands back for an OAuth app whose tokens
/// do not expire, and what somebody pasting a personal access token supplies. The prefixes GitHub
/// documents for its own token formats are <c>gho_</c> (OAuth app), <c>ghu_</c> (GitHub App user),
/// <c>ghp_</c> (classic PAT) and <c>github_pat_</c> (fine-grained PAT).
/// </item>
/// <item>
/// An <b>OAuth record</b> - a JSON object carrying <c>access</c>, and, when the OAuth app has token
/// expiration enabled, <c>refresh</c> and <c>expires</c> as well. GitHub only issues the latter two
/// when that setting is on, so this treats them as present-or-absent rather than required: a record
/// without them is a non-expiring token, not a broken one.
/// </item>
/// </list>
/// Copilot has <b>no metered API key</b>: there is no per-token billing surface to fall back to, so
/// a credential that is neither of the above authenticates nothing and is better refused where
/// somebody can read the reason than inside a container that has already been launched.
/// </summary>
public static class CopilotCredential
{
    /// <summary>
    /// The token prefixes GitHub documents for credentials that can carry a Copilot entitlement.
    /// </summary>
    static readonly string[] _tokenPrefixes = ["gho_", "ghu_", "ghp_", "ghs_", "github_pat_"];

    /// <summary>
    /// Whether the credential is a JSON OAuth record rather than a bare token. A GitHub token is an
    /// opaque string and can never be a JSON object, so the discriminator does not depend on either
    /// shape's internals staying the way they are today.
    /// </summary>
    /// <param name="apiKey">The stored credential, already revealed.</param>
    /// <returns><see langword="true"/> when it is an OAuth record.</returns>
    public static bool IsOAuthRecord(AIProviderApiKey apiKey) =>
        apiKey.Value.AsSpan().TrimStart().StartsWith("{");

    /// <summary>
    /// Whether the credential can authenticate the Copilot CLI at all - a bare GitHub token in one
    /// of the documented formats, or an OAuth record carrying an access token.
    /// </summary>
    /// <param name="apiKey">The stored credential, already revealed.</param>
    /// <returns><see langword="true"/> when it is usable.</returns>
    public static bool IsUsable(AIProviderApiKey apiKey) => !string.IsNullOrWhiteSpace(AccessTokenFor(apiKey));

    /// <summary>
    /// The bearer token to send, whichever shape the credential arrived in.
    /// </summary>
    /// <param name="apiKey">The stored credential, already revealed.</param>
    /// <returns>The access token, or an empty string when the credential carries none.</returns>
    public static string AccessTokenFor(AIProviderApiKey apiKey)
    {
        var value = Normalize(apiKey).Value;
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        if (!IsOAuthRecord(apiKey))
        {
            return _tokenPrefixes.Any(prefix => value.StartsWith(prefix, StringComparison.Ordinal))
                ? value
                : string.Empty;
        }

        try
        {
            return JsonNode.Parse(apiKey.Value) is JsonObject record && record["access"]?.GetValue<string>() is { } access && !string.IsNullOrWhiteSpace(access)
                ? access
                : string.Empty;
        }
        catch (Exception exception) when (exception is JsonException or FormatException or InvalidOperationException)
        {
            // A half-pasted record is a misconfiguration, not something to throw out of a dispatch
            // pass - the caller reads an empty token as "not usable" and says so in the log.
            return string.Empty;
        }
    }

    /// <summary>
    /// Gets the HTTP headers Copilot's own endpoints expect for the credential.
    /// </summary>
    /// <param name="apiKey">The configured credential.</param>
    /// <returns>The authentication headers.</returns>
    public static IReadOnlyList<KeyValuePair<string, string>> HeadersFor(AIProviderApiKey apiKey) =>
        [new("Authorization", $"Bearer {AccessTokenFor(apiKey)}")];

    /// <summary>
    /// Removes whitespace introduced when a token is copied out of wrapped terminal output. GitHub
    /// tokens contain none; call this after revealing a protected credential, never on ciphertext.
    /// An OAuth record is left untouched - whitespace is legal inside JSON.
    /// </summary>
    /// <param name="apiKey">The revealed credential.</param>
    /// <returns>The credential without pasted whitespace.</returns>
    public static AIProviderApiKey Normalize(AIProviderApiKey apiKey) =>
        IsOAuthRecord(apiKey)
            ? apiKey
            : new string([.. apiKey.Value.Where(character => !char.IsWhiteSpace(character))]);
}

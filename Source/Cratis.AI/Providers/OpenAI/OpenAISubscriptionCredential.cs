// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using System.Text.Json.Nodes;

namespace Cratis.AI.Providers.OpenAI;

/// <summary>
/// The OAuth record a ChatGPT subscription is authenticated by - the shape Pi keeps in
/// <c>~/.pi/agent/auth.json</c> for its built-in <c>openai-codex</c> provider, and the shape
/// Direct stores as that provider's credential.
/// <para>
/// The refresh token is the part that matters operationally. OpenAI's token endpoint <b>rotates</b>
/// it: every refresh returns a new one and retires the one that was used (Pi's own reader requires
/// <c>refresh_token</c> on every response, and the Codex CLI reports a reused one as "refresh token
/// was already used"). So this record is not a value that can be copied around freely - there is
/// exactly one live holder of a given lineage at a time, which is why Direct refreshes it
/// centrally and records the rotation rather than letting each worker container do it.
/// </para>
/// </summary>
/// <param name="Access">The bearer token requests are made with.</param>
/// <param name="Refresh">The rotating refresh token the next access token is minted from.</param>
/// <param name="Expires">When the access token expires, as milliseconds since the Unix epoch - the unit Pi stores.</param>
/// <param name="AccountId">The ChatGPT account the plan belongs to. Optional; Pi does not require it.</param>
public record OpenAISubscriptionCredential(string Access, string Refresh, long Expires, string? AccountId)
{
    /// <summary>
    /// What a worker container is given in place of the refresh token. Pi requires the field to be
    /// present - it calls a record without one <c>invalid_state</c> - but it only ever reads it when
    /// the access token has expired, so a placeholder is enough to satisfy the shape while making it
    /// impossible for a container to spend the real one.
    /// </summary>
    public const string RefreshTokenHeldByDirect = "held-by-direct";

    /// <summary>
    /// Gets when the access token expires.
    /// </summary>
    public DateTimeOffset ExpiresAt => DateTimeOffset.FromUnixTimeMilliseconds(Expires);

    /// <summary>
    /// Whether the access token is already spent, or close enough to it that a session started now
    /// would likely outlive it.
    /// </summary>
    /// <param name="margin">How much life the token must have left to be worth dispatching with.</param>
    /// <param name="now">The current time.</param>
    /// <returns><see langword="true"/> when it should be refreshed before use.</returns>
    public bool NeedsRefresh(TimeSpan margin, DateTimeOffset now) => ExpiresAt - now <= margin;

    /// <summary>
    /// Reads a stored credential, when it is one.
    /// </summary>
    /// <param name="apiKey">The stored credential, already revealed.</param>
    /// <returns>The parsed record, or <see langword="null"/> when it is not a usable subscription credential.</returns>
    public static OpenAISubscriptionCredential? TryParse(AIProviderApiKey apiKey)
    {
        if (!OpenAICredential.IsSubscriptionCredential(apiKey))
        {
            return null;
        }

        try
        {
            if (JsonNode.Parse(apiKey.Value) is not JsonObject record)
            {
                return null;
            }

            var access = record["access"]?.GetValue<string>();
            var refresh = record["refresh"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(access) || string.IsNullOrWhiteSpace(refresh) || record["expires"] is not { } expires)
            {
                return null;
            }

            return new(access, refresh, expires.GetValue<long>(), record["accountId"]?.GetValue<string>());
        }
        catch (Exception exception) when (exception is JsonException or FormatException or InvalidOperationException)
        {
            // A half-pasted or wrongly-typed record is a misconfiguration, not something to sink the
            // dispatch pass with - the caller treats null as "not usable" and says so in the log.
            return null;
        }
    }

    /// <summary>
    /// The form handed to a worker container: the live access token, and <b>no usable refresh
    /// token</b>.
    /// </summary>
    /// <remarks>
    /// This is the invariant that makes a subscription safe to dispatch with at all. OpenAI retires
    /// a refresh token the moment it is spent, so a container that refreshed would silently become
    /// the only holder of a live credential and then exit, taking it with it - leaving the stored one
    /// retired at the vendor and the subscription dead. Withholding the refresh token removes that
    /// possibility entirely rather than relying on sessions finishing in time: the worst a container
    /// can now do is fail to authenticate once its access token runs out, which is recoverable and
    /// says so.
    /// </remarks>
    /// <returns>The credential to seed the container's Pi credential store with.</returns>
    public OpenAISubscriptionCredential ForWorker() => this with { Refresh = RefreshTokenHeldByDirect };

    /// <summary>
    /// Renders the record back into the form Pi's credential store and Direct's own storage hold.
    /// </summary>
    /// <returns>The JSON object.</returns>
    public AIProviderApiKey ToApiKey()
    {
        var record = new JsonObject
        {
            ["type"] = "oauth",
            ["access"] = Access,
            ["refresh"] = Refresh,
            ["expires"] = Expires
        };

        if (!string.IsNullOrWhiteSpace(AccountId))
        {
            record["accountId"] = AccountId;
        }

        return new(record.ToJsonString());
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using System.Text.Json.Nodes;

namespace Cratis.AI.Providers.OpenAI;

/// <summary>
/// Tells the two kinds of OpenAI credential apart, the same way
/// <see cref="Anthropic.AnthropicCredential"/> does for Anthropic and for the same reason: they
/// authenticate through entirely different mechanisms, they are pasted into the same "API key"
/// field in a provider's configuration, and sending one the other's way is an HTTP 401 that names
/// neither. Ported from Direct's <c>AIProviders.OpenAI.OpenAICredential</c> (plan Section 5.2 step 3).
/// <list type="bullet">
/// <item>
/// An <b>API key</b> (<c>sk-…</c>, including the <c>sk-proj-…</c> project-scoped form) is created in
/// the OpenAI platform console, billed per token, and travels as an <c>Authorization: Bearer</c>
/// header to <c>api.openai.com</c> - or as the vendor-standard <c>OPENAI_API_KEY</c> variable the
/// CLIs read.
/// </item>
/// <item>
/// A <b>subscription credential</b> is the OAuth record a <b>ChatGPT</b> plan (Plus, Pro, Business,
/// Enterprise) is authenticated by. Pi mints it through its own built-in <c>openai-codex</c>
/// provider and stores it in <c>~/.pi/agent/auth.json</c>. It is a JSON object, not a string,
/// because it carries the refresh token and expiry a harness needs to keep itself authenticated:
/// <c>type</c>, <c>access</c>, <c>refresh</c> and <c>expires</c> are all required. It is only a
/// credential against the ChatGPT backend, never against <c>api.openai.com</c>.
/// </item>
/// </list>
/// The discriminator is whether the credential is a <b>JSON object</b>. An API key is an opaque
/// string and can never be one, so this does not depend on either credential's internal shape
/// staying the way it is today - which the <c>sk-</c> prefix would, and which is OpenAI's to change.
/// </summary>
public static class OpenAICredential
{
    /// <summary>
    /// The fields a harness requires in a stored OAuth record before it will call the provider ready.
    /// </summary>
    static readonly string[] _requiredFields = ["type", "access", "refresh", "expires"];

    /// <summary>
    /// Whether the credential is a ChatGPT subscription OAuth record rather than an API key.
    /// </summary>
    /// <param name="apiKey">The stored credential, already revealed.</param>
    /// <returns><see langword="true"/> when it is a subscription credential.</returns>
    public static bool IsSubscriptionCredential(AIProviderApiKey apiKey) =>
        apiKey.Value.AsSpan().TrimStart().StartsWith("{");

    /// <summary>
    /// Whether the credential is a subscription record a harness will actually accept - a
    /// well-formed JSON object carrying every field it needs. A record missing its refresh token or
    /// expiry is reported by some harnesses only from inside a container that has already been
    /// launched, so it is worth catching where a person can still read the reason.
    /// </summary>
    /// <param name="apiKey">The stored credential, already revealed.</param>
    /// <returns><see langword="true"/> when it is a usable subscription credential.</returns>
    public static bool IsUsableSubscriptionCredential(AIProviderApiKey apiKey)
    {
        if (!IsSubscriptionCredential(apiKey))
        {
            return false;
        }

        try
        {
            return JsonNode.Parse(apiKey.Value) is JsonObject record &&
                   _requiredFields.All(field => record[field] is not null);
        }
        catch (JsonException)
        {
            return false;
        }
    }
}

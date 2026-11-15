// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.ReverseProxy.Protocols;

/// <summary>
/// Knows what each <see cref="AIProtocol"/> looks like on the wire: which requests belong to it, how it names a model
/// listing, how it reports an error, and how it carries a credential.
/// </summary>
public static class AIProtocols
{
    /// <summary>
    /// The header Anthropic's API requires on every request. Its presence marks a request as Anthropic-shaped.
    /// </summary>
    public const string AnthropicVersionHeader = "anthropic-version";

    /// <summary>
    /// The version sent to an Anthropic-protocol backend when the caller named none.
    /// </summary>
    public const string DefaultAnthropicVersion = "2023-06-01";

    static readonly string[] _anthropicPaths = ["/v1/messages", "/v1/complete"];
    static readonly string[] _openAIPaths = ["/v1/chat/completions", "/v1/completions", "/v1/embeddings", "/v1/responses"];

    /// <summary>
    /// Parses the protocol names used in configuration (<c>openai</c>, <c>anthropic</c>, <c>claude</c>), ignoring case and
    /// separators such as <c>,</c> and <c>|</c>.
    /// </summary>
    /// <param name="names">The names, for example <c>openai,anthropic</c>.</param>
    /// <returns>The protocols named; <see cref="AIProtocol.None"/> when none is recognized.</returns>
    public static AIProtocol Parse(IEnumerable<string>? names)
    {
        var protocols = AIProtocol.None;
        foreach (var name in (names ?? []).SelectMany(name => name.Split([',', '|', ' ', ';'], StringSplitOptions.RemoveEmptyEntries)))
        {
            protocols |= name.Trim().ToLowerInvariant() switch
            {
                "openai" or "open-ai" or "openai-compatible" => AIProtocol.OpenAI,
                "anthropic" or "claude" or "messages" => AIProtocol.Anthropic,
                _ => AIProtocol.None
            };
        }

        return protocols;
    }

    /// <summary>
    /// Names the protocols in the form <see cref="Parse"/> reads back.
    /// </summary>
    /// <param name="protocols">The protocols.</param>
    /// <returns>One lowercase name per protocol.</returns>
    public static IReadOnlyList<string> Names(AIProtocol protocols) =>
        [.. Enum.GetValues<AIProtocol>().Where(protocol => protocol != AIProtocol.None && protocols.HasFlag(protocol)).Select(protocol => protocol.ToString().ToLowerInvariant())];

    /// <summary>
    /// Works out which protocol a request is spoken in, from its path below the proxy's prefix.
    /// </summary>
    /// <param name="path">The path starting at <c>/v1/...</c>.</param>
    /// <param name="hasAnthropicVersion">Whether the request carries <c>anthropic-version</c>.</param>
    /// <returns>The protocol; <see cref="AIProtocol.None"/> for a path no protocol owns.</returns>
    public static AIProtocol Detect(string path, bool hasAnthropicVersion)
    {
        var normalized = path.TrimEnd('/');
        if (_anthropicPaths.Any(candidate => normalized.Equals(candidate, StringComparison.OrdinalIgnoreCase)))
        {
            return AIProtocol.Anthropic;
        }

        if (_openAIPaths.Any(candidate => normalized.Equals(candidate, StringComparison.OrdinalIgnoreCase)))
        {
            return AIProtocol.OpenAI;
        }

        // The model listing is shared by both protocols; the Anthropic SDK always sends its version header.
        if (normalized.Equals("/v1/models", StringComparison.OrdinalIgnoreCase) || normalized.StartsWith("/v1/models/", StringComparison.OrdinalIgnoreCase))
        {
            return hasAnthropicVersion ? AIProtocol.Anthropic : AIProtocol.OpenAI;
        }

        return AIProtocol.None;
    }

    /// <summary>
    /// Writes an error in the shape the caller's protocol expects, so its SDK reports the real reason.
    /// </summary>
    /// <param name="protocol">The protocol the caller speaks.</param>
    /// <param name="statusCode">The HTTP status.</param>
    /// <param name="type">The machine-readable error type.</param>
    /// <param name="message">What went wrong, in words a person can act on.</param>
    /// <returns>The JSON body.</returns>
    public static string Error(AIProtocol protocol, int statusCode, string type, string message) =>
        protocol == AIProtocol.Anthropic
            ? JsonSerializer.Serialize(new { type = "error", error = new { type, message } })
            : JsonSerializer.Serialize(new { error = new { message, type, param = (string?)null, code = statusCode.ToString() } });

    /// <summary>
    /// Reads the credential a caller presented, whichever protocol's header carries it.
    /// </summary>
    /// <param name="request">The request.</param>
    /// <returns>The credential; empty when none was presented.</returns>
    public static string PresentedCredential(Microsoft.AspNetCore.Http.HttpRequest request)
    {
        var authorization = request.Headers.Authorization.ToString();
        if (authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return authorization["Bearer ".Length..].Trim();
        }

        return request.Headers["x-api-key"].ToString().Trim();
    }
}

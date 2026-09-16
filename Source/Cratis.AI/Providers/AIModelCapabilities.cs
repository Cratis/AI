// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;

namespace Cratis.AI.Providers;

/// <summary>
/// Enriches provider model identifiers with capability metadata. Ported from Direct's
/// <c>AIProviders.AIModelCapabilities</c> (plan Section 5.2 step 2).
/// </summary>
/// <remarks>
/// Inferred from substrings of the model identifier itself - vendors do not expose a capability
/// catalog, so this is a best-effort classification rather than an authoritative one. Ported
/// verbatim from the donor deployment's own marker lists; review and extend them as new model
/// families ship, the same way the donor repository does.
/// </remarks>
public static class AIModelCapabilities
{
    static readonly string[] _reasoningMarkers = ["claude", "gpt-5", "o1", "o3", "o4", "glm"];
    static readonly string[] _visionMarkers = ["vision", "image", "claude", "gpt-4o", "gpt-5", "glm-4v"];
    static readonly string[] _nonConversationalMarkers = ["embedding", "whisper", "tts", "moderation", "dall-e"];

    /// <summary>
    /// Gets the capabilities known for a provider model identifier.
    /// </summary>
    /// <param name="model">The exact provider model identifier.</param>
    /// <returns>The known capabilities.</returns>
    public static IReadOnlySet<AIModelCapability> For(ModelName model)
    {
        var identifier = model.Value.ToLowerInvariant();
        var capabilities = new HashSet<AIModelCapability>();
        if (_nonConversationalMarkers.Any(identifier.Contains))
        {
            return capabilities;
        }

        capabilities.Add(AIModelCapability.Conversational);
        capabilities.Add(AIModelCapability.ToolUse);
        if (_reasoningMarkers.Any(identifier.Contains))
        {
            capabilities.Add(AIModelCapability.Reasoning);
        }

        if (_visionMarkers.Any(identifier.Contains))
        {
            capabilities.Add(AIModelCapability.Vision);
        }

        return capabilities;
    }

    /// <summary>
    /// Produces a friendly display name without changing the provider identifier.
    /// </summary>
    /// <param name="model">The exact provider model identifier.</param>
    /// <returns>The friendly display name.</returns>
    public static string DisplayNameFor(ModelName model) =>
        string.Join(' ', model.Value.Split(['-', '_'], StringSplitOptions.RemoveEmptyEntries)
            .Select(part => part.Length <= 3 ? part.ToUpperInvariant() : char.ToUpperInvariant(part[0]) + part[1..]));

    /// <summary>
    /// Determines whether a model can serve an agent invocation mode.
    /// </summary>
    /// <param name="mode">How the agent is invoked.</param>
    /// <param name="model">The selected model.</param>
    /// <returns><see langword="true"/> when the model satisfies the invocation.</returns>
    public static bool Supports(AgentInvocationMode mode, ModelName model)
    {
        var capabilities = For(model);
        return mode == AgentInvocationMode.Job
            ? capabilities.Contains(AIModelCapability.ToolUse)
            : capabilities.Contains(AIModelCapability.Conversational);
    }
}

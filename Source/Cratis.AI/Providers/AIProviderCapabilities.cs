// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// What each <see cref="AIProviderType"/> can be used for.
/// </summary>
/// <remarks>
/// Intrinsic to the vendor rather than inferred from a model identifier, which is the difference
/// between this and <see cref="AIModelCapabilities"/>: a vendor either exposes an agentic harness
/// surface or it does not, and no amount of reading the model name will tell you.
/// </remarks>
public static class AIProviderCapabilities
{
    static readonly IReadOnlySet<AIProviderCapability> _conversationalAndAgentic =
        new HashSet<AIProviderCapability> { AIProviderCapability.Conversational, AIProviderCapability.Agentic };

    static readonly IReadOnlySet<AIProviderCapability> _agentic =
        new HashSet<AIProviderCapability> { AIProviderCapability.Agentic };

    static readonly IReadOnlySet<AIProviderCapability> _decision =
        new HashSet<AIProviderCapability> { AIProviderCapability.Decision };

    /// <summary>
    /// Gets the capabilities a provider type offers.
    /// </summary>
    /// <param name="type">The provider type.</param>
    /// <returns>The capabilities.</returns>
    public static IReadOnlySet<AIProviderCapability> For(AIProviderType type) => type switch
    {
        // A subscription-backed harness provider: it drives a CLI agent session and exposes no
        // chat-completions surface of its own, so it can never serve an in-process completion.
        AIProviderType.OpenAICodex => _agentic,

        // Weighs choices and returns probabilities. Deliberately not conversational: a decision
        // engine handed an agent session would have nothing to say, and declaring the capability it
        // lacks is what stops that being configurable in the first place.
        AIProviderType.DecisionEngine => _decision,

        _ => _conversationalAndAgentic,
    };

    /// <summary>
    /// Determines whether a provider type satisfies every required capability.
    /// </summary>
    /// <param name="type">The provider type.</param>
    /// <param name="required">The required capabilities.</param>
    /// <returns><see langword="true"/> when every requirement is satisfied.</returns>
    public static bool Supports(AIProviderType type, IReadOnlySet<AIProviderCapability> required) =>
        required.IsSubsetOf(For(type));

    /// <summary>
    /// Determines whether a provider type offers a capability.
    /// </summary>
    /// <param name="type">The provider type.</param>
    /// <param name="capability">The capability.</param>
    /// <returns><see langword="true"/> when the capability is offered.</returns>
    public static bool Supports(AIProviderType type, AIProviderCapability capability) =>
        For(type).Contains(capability);
}

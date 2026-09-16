// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;

namespace Cratis.AI.Providers;

/// <summary>
/// The tier-to-model mapping every provider falls back to when its own configuration names nothing -
/// the current model from each supported vendor that best matches each tier. Ported unchanged from
/// Direct's <c>AIProviders.TierModelDefaults</c> (plan Section 5.2 step 6).
/// </summary>
/// <remarks>
/// <para>
/// Deliberately the only place a vendor's concrete model names are hardcoded. A provider whose
/// <see cref="TierModels"/> configuration leaves a tier unset resolves through here, which is also
/// what keeps a provider configured before tiers existed dispatchable without anyone touching it.
/// Azure OpenAI and OpenAI-compatible gateways name models by deployment, so they have no defaults
/// to offer: a tier resolves there only once an operator maps it.
/// </para>
/// <para>
/// <b>The model names below are ported verbatim from the donor deployment's own configuration</b> -
/// they are a snapshot of whichever models were current for Direct's own operators at the time of
/// porting, not a claim about any vendor's actual model catalog. Whoever adopts this package should
/// review and update them before relying on the defaults in production; a consumer with an explicit
/// per-tier <see cref="TierModels"/> configured on each provider never reaches this fallback at all.
/// </para>
/// </remarks>
public static class TierModelDefaults
{
    /// <summary>
    /// The default mapping for a vendor.
    /// </summary>
    /// <param name="type">The vendor the provider talks to.</param>
    /// <returns>The vendor's tier mapping, or <see cref="TierModels.NotSet"/> for vendors whose model names are deployment-specific.</returns>
    public static TierModels For(AIProviderType type) => type switch
    {
        AIProviderType.Anthropic => new TierModels(
            Fast: new ModelName("claude-haiku-4-5"),
            Balanced: new ModelName("claude-sonnet-4-5"),
            Powerful: new ModelName("claude-opus-4-5"),
            Premier: new ModelName("claude-fable-5")),

        AIProviderType.ZAI => new TierModels(
            Fast: new ModelName("glm-5.3-flash"),
            Balanced: new ModelName("glm-5.2"),
            Powerful: new ModelName("glm-5.3"),
            Premier: new ModelName("glm-5.3")),

        AIProviderType.OpenAI => new TierModels(
            Fast: new ModelName("gpt-5-mini"),
            Balanced: new ModelName("gpt-5.2"),
            Powerful: new ModelName("gpt-5.2"),
            Premier: new ModelName("gpt-5.2-pro")),

        AIProviderType.OpenAICodex => new TierModels(
            Fast: new ModelName("gpt-5.3-codex-spark"),
            Balanced: new ModelName("gpt-5.3-codex"),
            Powerful: new ModelName("gpt-5.3-codex"),
            Premier: new ModelName("gpt-5.3-codex")),

        // Azure OpenAI addresses a model by its deployment name and a self-hosted gateway's models
        // are unknowable in advance - a tier resolves on these only once an operator maps it.
        _ => TierModels.NotSet,
    };
}

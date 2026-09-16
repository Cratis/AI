// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The capability tier a completion or worker session asks an AI provider for - the vendor-neutral
/// way of saying how much model one wants, translated per provider into the concrete model that
/// vendor offers. Ported from Direct's <c>AIProviders.ModelTier</c> (plan Section 5.2 step 1).
/// </summary>
/// <remarks>
/// Every vendor names its ladder differently - Anthropic has Haiku/Sonnet/Opus, Z.ai has
/// flash/5.2/5.3, OpenAI has its mini and full sizes - and an operator pointing agents at providers
/// across vendors would otherwise have to know every vendor's names to say "give this the cheap
/// one". The tier is the package's own ladder; a provider's configuration maps each tier to a
/// concrete model, so an agent moved from one provider to another keeps meaning the same thing.
/// <para>
/// Four tiers, in ascending capability and cost. A vendor with nothing between its everyday and its
/// best model maps more than one tier to the same model - the ladder is what a consumer wants to
/// express, not a claim about the vendor's catalog.
/// </para>
/// </remarks>
public enum ModelTier
{
    /// <summary>
    /// The quick, cheap tier - high-volume, low-stakes work. Anthropic's Haiku, Z.ai's flash,
    /// OpenAI's mini sizes.
    /// </summary>
    Fast = 0,

    /// <summary>
    /// The everyday workhorse tier - what most work should run on. Anthropic's Sonnet, Z.ai's
    /// previous-generation flagship.
    /// </summary>
    Balanced = 1,

    /// <summary>
    /// The deep-reasoning tier - work whose difficulty justifies the cost. Anthropic's Opus, Z.ai's
    /// current flagship.
    /// </summary>
    Powerful = 2,

    /// <summary>
    /// The best a vendor currently offers, cost barely considered - the frontier tier for the work
    /// that must not fail.
    /// </summary>
    Premier = 3,
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
namespace Cratis.AI.Providers;

/// <summary>
/// Whether a configured provider can serve a completion at all, right now - the question every
/// sweep that is about to spend work on a completion has to ask before it starts.
/// </summary>
/// <remarks>
/// There are two ways a provider is unusable and only one of them used to be asked about. A
/// rate-limit cooldown is the loud one: it is recorded, it lapses on its own, and the sweeps already
/// waited it out. A provider that resolves no model for any tier is the quiet one - it never
/// recovers by itself, and nothing noticed. Production ran fifty re-triages every fifteen minutes
/// into exactly that state for a fortnight, each one starting three agents that could not send a
/// single request, which is also what kept the one provider that did have models permanently inside
/// its vendor's rate limit.
/// </remarks>
public static class ProviderServing
{
    /// <summary>
    /// Whether the provider can serve a completion right now.
    /// </summary>
    /// <param name="provider">The provider to judge.</param>
    /// <param name="now">The current time, for the rate-limit cooldown.</param>
    /// <returns><see langword="true"/> when a completion sent to it has somewhere to go.</returns>
    public static bool CanServe(this ConfiguredAIProvider provider, DateTimeOffset now) =>
        !provider.IsRateLimited(now) && provider.NamesAModel();

    /// <summary>
    /// Whether the vendor is turning this provider's calls away over its own limits.
    /// </summary>
    /// <param name="provider">The provider to judge.</param>
    /// <param name="now">The current time.</param>
    /// <returns><see langword="true"/> while the cooldown is still running.</returns>
    public static bool IsRateLimited(this ConfiguredAIProvider provider, DateTimeOffset now) =>
        provider.RateLimitedUntil > now;

    /// <summary>
    /// Whether any capability tier resolves to a model on this provider - asked through the very
    /// resolution the completion path uses, so the two can never disagree about what "has a model"
    /// means.
    /// </summary>
    /// <param name="provider">The provider to judge.</param>
    /// <returns><see langword="true"/> when at least one tier resolves.</returns>
    public static bool NamesAModel(this ConfiguredAIProvider provider) =>
        Enum.GetValues<ModelTier>().Any(tier =>
            !TierModelResolution.Resolve(provider.TierModels, provider.AvailableModels, tier).Equals(ModelName.NotSet));
}

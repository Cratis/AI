// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// Picks which member of a pool a completion is dispatched to. A member with a known, non-exhausted
/// remaining capacity - a configured <see cref="AIProviderUsageCapacity"/> ceiling measured against
/// its refreshed <see cref="UsageReporting.ProviderUsageLevel"/> - wins over one without: a real
/// measurement of remaining capacity is a better bet than a proxy for it (issue #1061). Among members
/// with no known remaining capacity, the one with the least tokens burnt over the trailing week wins
/// - recent burn is the best available proxy for "most available" absent a real measurement, and a
/// member that has never served a job wins outright. A member with a known but exhausted ceiling, or
/// that has failed a real call recently, ranks after every other member regardless of burn - a
/// provider that is out of capacity or fails every call is not a usable pick just because it has
/// burnt few tokens succeeding (issue #1060). Pure so the strategy is directly specifiable; the
/// tie-breaks (fewest recent jobs, then declaration order) make the pick deterministic among members
/// with the same standing.
/// </summary>
public static class PoolMemberSelector
{
    /// <summary>
    /// Selects the pool member to dispatch to.
    /// </summary>
    /// <param name="members">The pool's members, in declaration order.</param>
    /// <param name="selection">The facts to rank members by.</param>
    /// <returns>The member to dispatch to, or <see langword="null"/> for an empty pool.</returns>
    public static AIProviderPoolMember? Select(IEnumerable<AIProviderPoolMember> members, PoolSelectionData selection) =>
        Candidates(members, selection).FirstOrDefault();

    /// <summary>
    /// Every member the pool could dispatch to, best first.
    /// </summary>
    /// <param name="members">The pool's members, in declaration order.</param>
    /// <param name="selection">The facts to rank members by.</param>
    /// <returns>The members in dispatch preference order.</returns>
    /// <remarks>
    /// A caller that can fail over wants the whole ranking rather than the winner, so it can try the
    /// next-best member without re-ranking against facts that have since moved.
    /// </remarks>
    public static IEnumerable<AIProviderPoolMember> Candidates(IEnumerable<AIProviderPoolMember> members, PoolSelectionData selection) =>
        members
            .Select((member, index) => (Member: member, Index: index))
            .OrderBy(candidate => selection.RecentFailuresByProvider.GetValueOrDefault(candidate.Member.ProviderId, 0) > 0)
            .ThenBy(candidate => IsCapacityExhausted(candidate.Member.ProviderId, selection))
            .ThenBy(candidate => HasAvailableCapacity(candidate.Member.ProviderId, selection) ? 0 : 1)
            .ThenByDescending(candidate => selection.RemainingCapacityByProvider.GetValueOrDefault(candidate.Member.ProviderId, long.MinValue))
            .ThenBy(candidate => selection.RecentTokensByProvider.GetValueOrDefault(candidate.Member.ProviderId, 0L))
            .ThenBy(candidate => selection.RecentJobsByProvider.GetValueOrDefault(candidate.Member.ProviderId, 0))
            .ThenBy(candidate => candidate.Index)
            .Select(candidate => candidate.Member);

    /// <summary>
    /// Whether a provider has a known remaining capacity that has run out - ranked after every other
    /// member, the closest analog to the rate-limit cooldown a provider without a configured ceiling
    /// has no equivalent of.
    /// </summary>
    /// <param name="providerId">The provider to check.</param>
    /// <param name="selection">The facts to check it against.</param>
    static bool IsCapacityExhausted(AIProviderId providerId, PoolSelectionData selection) =>
        selection.RemainingCapacityByProvider.TryGetValue(providerId, out var remaining) && remaining <= 0;

    /// <summary>
    /// Whether a provider has a known remaining capacity greater than zero - ranked ahead of every
    /// member whose remaining capacity is unknown, since it is measured rather than guessed at.
    /// </summary>
    /// <param name="providerId">The provider to check.</param>
    /// <param name="selection">The facts to check it against.</param>
    static bool HasAvailableCapacity(AIProviderId providerId, PoolSelectionData selection) =>
        selection.RemainingCapacityByProvider.TryGetValue(providerId, out var remaining) && remaining > 0;
}

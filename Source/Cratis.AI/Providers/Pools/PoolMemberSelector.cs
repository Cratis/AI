// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// Picks which member of a pool a completion is dispatched to: the one with the least tokens burnt
/// over the trailing week - recent burn is the best available proxy for "most available", and a
/// member that has never served a session wins outright. Pure so the strategy is directly
/// specifiable; the tie-breaks (fewest recent sessions, then declaration order) make the pick
/// deterministic. Ported unchanged from Direct's <c>AIProviders.Pools.PoolMemberSelector</c> (plan
/// Section 5.2 step 5).
/// </summary>
public static class PoolMemberSelector
{
    /// <summary>
    /// Selects the pool member to dispatch to - the head of <see cref="Candidates"/>.
    /// </summary>
    /// <param name="members">The pool's members, in declaration order.</param>
    /// <param name="recentTokensByProvider">Tokens burnt over the trailing week, keyed by provider - a member missing from the map has burnt none.</param>
    /// <param name="recentSessionsByProvider">Sessions served over the trailing week, keyed by provider - the first tie-break.</param>
    /// <returns>The member to dispatch to, or <see langword="null"/> for an empty pool.</returns>
    public static AIProviderPoolMember? Select(
        IEnumerable<AIProviderPoolMember> members,
        IReadOnlyDictionary<AIProviderId, long> recentTokensByProvider,
        IReadOnlyDictionary<AIProviderId, int> recentSessionsByProvider) =>
        Candidates(members, recentTokensByProvider, recentSessionsByProvider).FirstOrDefault();

    /// <summary>
    /// Every pool member in dispatch preference order, least-burnt first - what
    /// <see cref="Providers.Pools.AIProviderPoolDispatcher"/> walks to fail over to the next member
    /// when the one before it answers with a transient failure (a 429, most commonly), instead of
    /// only ever seeing the single best pick (Cratis/AI#337).
    /// </summary>
    /// <param name="members">The pool's members, in declaration order.</param>
    /// <param name="recentTokensByProvider">Tokens burnt over the trailing week, keyed by provider - a member missing from the map has burnt none.</param>
    /// <param name="recentSessionsByProvider">Sessions served over the trailing week, keyed by provider - the first tie-break.</param>
    /// <returns>The members, in preference order.</returns>
    public static IEnumerable<AIProviderPoolMember> Candidates(
        IEnumerable<AIProviderPoolMember> members,
        IReadOnlyDictionary<AIProviderId, long> recentTokensByProvider,
        IReadOnlyDictionary<AIProviderId, int> recentSessionsByProvider) =>
        members
            .Select((member, index) => (Member: member, Index: index))
            .OrderBy(candidate => recentTokensByProvider.GetValueOrDefault(candidate.Member.ProviderId, 0L))
            .ThenBy(candidate => recentSessionsByProvider.GetValueOrDefault(candidate.Member.ProviderId, 0))
            .ThenBy(candidate => candidate.Index)
            .Select(candidate => candidate.Member);
}

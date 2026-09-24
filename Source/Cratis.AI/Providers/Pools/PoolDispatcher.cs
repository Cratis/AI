// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// What trying one pool member produced - the vocabulary <see cref="PoolDispatcher.Dispatch{T}"/>
/// branches its loop on.
/// </summary>
public enum PoolAttemptOutcome
{
    /// <summary>
    /// The member served the call. The loop stops and hands back what it produced.
    /// </summary>
    Succeeded,

    /// <summary>
    /// The member was never actually tried with a real call - unconfigured, incompatible, saturated,
    /// or rate-limited. Not worth remembering against the provider; the loop moves to the next member.
    /// </summary>
    Skipped,

    /// <summary>
    /// A real call to the member failed in a way another member - or the same one, later - might not:
    /// a vendor rate limit, a server error, a network failure reaching it. Recorded against the
    /// provider so <see cref="PoolMemberSelector"/> stops ranking it first just because it has burnt
    /// nothing, and the loop moves to the next member.
    /// </summary>
    TransientFailure,

    /// <summary>
    /// A real call to the member failed in a way no other member can fix either - a rejected request,
    /// bad credentials. The loop stops rather than spending the rest of the pool on a mistake that is
    /// not about which provider answered.
    /// </summary>
    PermanentFailure,
}

/// <summary>
/// What a pool dispatch settled on.
/// </summary>
public enum PoolDispatchOutcome
{
    /// <summary>
    /// A member served the call.
    /// </summary>
    Succeeded,

    /// <summary>
    /// A member's real call failed in a way no other member could fix either, so the loop stopped
    /// rather than trying the rest of the pool.
    /// </summary>
    Stopped,

    /// <summary>
    /// Every member was tried (or skipped) without one serving the call, and nothing said to stop
    /// early.
    /// </summary>
    Exhausted,
}

/// <summary>
/// What trying one pool member produced, and - when it produced one - the value that came of it.
/// </summary>
/// <typeparam name="T">What a successful attempt produces.</typeparam>
/// <param name="Outcome">What happened when the member was tried.</param>
/// <param name="Value">What the member produced, when it produced one.</param>
/// <param name="Reason">Why it did not succeed - empty on <see cref="PoolAttemptOutcome.Succeeded"/>.</param>
public readonly record struct PoolAttempt<T>(PoolAttemptOutcome Outcome, T? Value, string Reason)
{
    /// <summary>
    /// Builds a successful attempt.
    /// </summary>
    /// <param name="value">What the member produced.</param>
    /// <returns>The <see cref="PoolAttempt{T}"/>.</returns>
    public static PoolAttempt<T> Succeeded(T value) => new(PoolAttemptOutcome.Succeeded, value, string.Empty);

    /// <summary>
    /// Builds an attempt that never reached a real call.
    /// </summary>
    /// <param name="reason">Why the member could not be tried.</param>
    /// <returns>The <see cref="PoolAttempt{T}"/>.</returns>
    public static PoolAttempt<T> Skipped(string reason) => new(PoolAttemptOutcome.Skipped, default, reason);

    /// <summary>
    /// Builds an attempt whose real call failed in a way worth trying elsewhere for.
    /// </summary>
    /// <param name="reason">Why the call failed.</param>
    /// <returns>The <see cref="PoolAttempt{T}"/>.</returns>
    public static PoolAttempt<T> TransientFailure(string reason) => new(PoolAttemptOutcome.TransientFailure, default, reason);

    /// <summary>
    /// Builds an attempt whose real call failed in a way no other member can fix.
    /// </summary>
    /// <param name="value">What the failed call actually produced, when there is something to hand back.</param>
    /// <param name="reason">Why the call failed.</param>
    /// <returns>The <see cref="PoolAttempt{T}"/>.</returns>
    public static PoolAttempt<T> PermanentFailure(T? value, string reason) => new(PoolAttemptOutcome.PermanentFailure, value, reason);
}

/// <summary>
/// What a pool dispatch settled on, and everything a caller needs to report or act on it.
/// </summary>
/// <typeparam name="T">What a successful dispatch produces.</typeparam>
/// <param name="Outcome">What happened.</param>
/// <param name="Value">What was produced - the served value on <see cref="PoolDispatchOutcome.Succeeded"/>, the failed value on <see cref="PoolDispatchOutcome.Stopped"/>, <see langword="default"/> on <see cref="PoolDispatchOutcome.Exhausted"/>.</param>
/// <param name="Reason">Why the dispatch did not succeed - the last member's own reason, or the reason handed in when nothing was ever tried.</param>
/// <param name="AnyTransientFailure">Whether at least one member's real call failed transiently - worth another whole attempt later, as opposed to an exhaustion made only of members that were never really tried.</param>
public readonly record struct PoolDispatchResult<T>(PoolDispatchOutcome Outcome, T? Value, string Reason, bool AnyTransientFailure)
{
    /// <summary>
    /// Builds a successful result.
    /// </summary>
    /// <param name="value">What was served.</param>
    /// <returns>The <see cref="PoolDispatchResult{T}"/>.</returns>
    public static PoolDispatchResult<T> Succeeded(T value) => new(PoolDispatchOutcome.Succeeded, value, string.Empty, false);

    /// <summary>
    /// Builds a result the loop stopped on because retrying elsewhere could not help.
    /// </summary>
    /// <param name="value">What the failed attempt actually produced, when there is something to hand back.</param>
    /// <param name="reason">Why it failed.</param>
    /// <returns>The <see cref="PoolDispatchResult{T}"/>.</returns>
    public static PoolDispatchResult<T> Stopped(T? value, string reason) => new(PoolDispatchOutcome.Stopped, value, reason, false);

    /// <summary>
    /// Builds a result for a pool that ran out of members without one serving the call.
    /// </summary>
    /// <param name="reason">The last member's own reason, or the reason handed in when nothing was ever tried.</param>
    /// <param name="anyTransientFailure">Whether at least one member's real call failed transiently.</param>
    /// <returns>The <see cref="PoolDispatchResult{T}"/>.</returns>
    public static PoolDispatchResult<T> Exhausted(string reason, bool anyTransientFailure) => new(PoolDispatchOutcome.Exhausted, default, reason, anyTransientFailure);
}

/// <summary>
/// The facts <see cref="PoolMemberSelector"/> ranks members by, gathered once per dispatch rather than
/// once per member tried.
/// </summary>
/// <param name="RecentTokensByProvider">Tokens burnt over the trailing week, keyed by provider.</param>
/// <param name="RecentJobsByProvider">Jobs served over the trailing week, keyed by provider.</param>
/// <param name="RecentFailuresByProvider">Real calls that failed recently, keyed by provider.</param>
/// <param name="RemainingCapacityByProvider">
/// How many tokens are left within a provider's configured usage capacity ceiling, keyed by
/// provider - a provider missing from the map has no known remaining capacity, either because it has
/// no ceiling configured or because its usage level has not been refreshed. Ranked ahead of
/// <paramref name="RecentTokensByProvider"/> when known and not exhausted: a real measurement of
/// remaining capacity is a better bet than a local proxy for it (issue #1061).
/// </param>
public record PoolSelectionData(
    IReadOnlyDictionary<AIProviderId, long> RecentTokensByProvider,
    IReadOnlyDictionary<AIProviderId, int> RecentJobsByProvider,
    IReadOnlyDictionary<AIProviderId, int> RecentFailuresByProvider,
    IReadOnlyDictionary<AIProviderId, long> RemainingCapacityByProvider)
{
    /// <summary>
    /// Nothing is known about any member.
    /// </summary>
    /// <remarks>
    /// Every map empty means "no information", which ranks every member equally and leaves
    /// declaration order to decide - distinct from a measured zero, which is a real fact about a
    /// member and ranks it ahead of one that has burnt something.
    /// </remarks>
    public static readonly PoolSelectionData Nothing = new(
        new Dictionary<AIProviderId, long>(),
        new Dictionary<AIProviderId, int>(),
        new Dictionary<AIProviderId, int>(),
        new Dictionary<AIProviderId, long>());
}

/// <summary>
/// The one pool-selection-and-failover loop chat completions (<see cref="ProviderAwareLanguageModel"/>)
/// and work dispatch (<c>Work.Scheduling.ActingAgentResolver</c>) both walk - previously two
/// hand-maintained copies of the same loop (issue #1060). Walks the pool's members in
/// <see cref="PoolMemberSelector"/>'s ranked order, trying each until one succeeds, a permanent
/// failure says trying the rest of the pool cannot help, or the pool runs out of members.
/// </summary>
/// <remarks>
/// The seam #1061's usage-based selection is meant to land in: the <c>tryUse</c> delegate passed to
/// <see cref="Dispatch{T}"/> is the only thing that differs between callers, and
/// <see cref="PoolSelectionData"/> is the only ranking input a future caller would extend - neither
/// the loop nor the member exclusion changes to add a new ranking signal.
/// </remarks>
public static class PoolDispatcher
{
    /// <summary>
    /// Dispatches to the best available member of a pool, trying the next least-burnt, cleanest
    /// member whenever one fails in a way retrying elsewhere might fix.
    /// </summary>
    /// <typeparam name="T">What a successful dispatch produces.</typeparam>
    /// <param name="members">The pool's members, in declaration order.</param>
    /// <param name="selection">The facts <see cref="PoolMemberSelector"/> ranks members by.</param>
    /// <param name="failureMemory">Where a transient failure is recorded against its provider, so a later dispatch's ranking sees it.</param>
    /// <param name="exhaustedReason">The reason to report when no member was ever actually tried (an empty pool, or every candidate excluded before the loop began).</param>
    /// <param name="tryUse">Tries one member, and classifies what happened.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="PoolDispatchResult{T}"/>.</returns>
    public static async Task<PoolDispatchResult<T>> Dispatch<T>(
        IReadOnlyList<AIProviderPoolMember> members,
        PoolSelectionData selection,
        IRecentProviderFailures failureMemory,
        string exhaustedReason,
        Func<AIProviderPoolMember, CancellationToken, Task<PoolAttempt<T>>> tryUse,
        CancellationToken cancellationToken = default)
    {
        var remaining = members.ToList();
        var lastReason = exhaustedReason;
        var anyTransientFailure = false;

        while (remaining.Count > 0)
        {
            var member = PoolMemberSelector.Select(remaining, selection);
            if (member is null)
            {
                break;
            }

            var attempt = await tryUse(member, cancellationToken);
            switch (attempt.Outcome)
            {
                case PoolAttemptOutcome.Succeeded:
                    return PoolDispatchResult<T>.Succeeded(attempt.Value!);

                case PoolAttemptOutcome.PermanentFailure:
                    return PoolDispatchResult<T>.Stopped(attempt.Value, attempt.Reason);

                case PoolAttemptOutcome.TransientFailure:
                    failureMemory.Record(member.ProviderId);
                    anyTransientFailure = true;
                    lastReason = attempt.Reason;
                    remaining.Remove(member);
                    break;

                default: // Skipped
                    lastReason = attempt.Reason;
                    remaining.Remove(member);
                    break;
            }
        }

        return PoolDispatchResult<T>.Exhausted(lastReason, anyTransientFailure);
    }
}

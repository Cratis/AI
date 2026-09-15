// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage.Daily;

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// Sums what each provider has burnt recently - shared between chat completions and worker
/// dispatch (once both exist in the package), so both pick pool members off the same facts. Ported
/// from Direct's <c>AIProviders.Pools.IProviderBurn</c>/<c>ProviderBurn</c> (plan Section 5.2 step
/// 5), rewired onto the package's own <see cref="IRecordedAgentSessions"/> (Usage subsystem, plan
/// Section 5.3) in place of Direct's <c>ILanguageModelJobs</c>.
/// </summary>
public interface IProviderBurn
{
    /// <summary>
    /// Sums what each provider has burnt over the trailing week.
    /// </summary>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The burn per provider.</returns>
    Task<ProviderBurnOverTrailingWeek> TrailingWeek(CancellationToken cancellationToken = default);
}

/// <summary>
/// Represents an implementation of <see cref="IProviderBurn"/> summing over recorded agent sessions.
/// </summary>
/// <param name="sessions">The recorded sessions to sum over.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> for the trailing-week window.</param>
public class ProviderBurn(IRecordedAgentSessions sessions, TimeProvider timeProvider) : IProviderBurn
{
    /// <inheritdoc/>
    public async Task<ProviderBurnOverTrailingWeek> TrailingWeek(CancellationToken cancellationToken = default)
    {
        var weekCutoff = timeProvider.GetUtcNow() - TimeSpan.FromDays(7);
        var recent = (await sessions.RecordedSince(weekCutoff, cancellationToken))
            .Where(session => session.ProviderId is not null)
            .ToList();

        var tokens = recent
            .GroupBy(session => session.ProviderId!)
            .ToDictionary(group => group.Key, group => group.Sum(session => session.InputTokens + session.OutputTokens));
        var sessionCounts = recent
            .GroupBy(session => session.ProviderId!)
            .ToDictionary(group => group.Key, group => group.Count());
        return new(tokens, sessionCounts);
    }
}

/// <summary>
/// What each provider has burnt over the trailing week - the facts <see cref="PoolMemberSelector"/>'s
/// least-burnt pick keys off.
/// </summary>
/// <param name="Tokens">Tokens burnt, keyed by provider - a provider missing from the map has burnt none.</param>
/// <param name="Sessions">Sessions served, keyed by provider - the first tie-break.</param>
public record ProviderBurnOverTrailingWeek(IReadOnlyDictionary<AIProviderId, long> Tokens, IReadOnlyDictionary<AIProviderId, int> Sessions);

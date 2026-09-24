// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage.Daily;

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// How much work a provider has actually been given, over the trailing week and over all time.
/// </summary>
/// <remarks>
/// <c language="csharp">[Passive]</c> because it is an aggregate over recorded sessions rather than
/// state a provider's own stream carries - there is no event that says "this provider's totals
/// changed", only sessions that were recorded against it.
/// </remarks>
/// <param name="ProviderId">The provider the work ran on.</param>
/// <param name="JobsLastWeek">Sessions in the trailing week.</param>
/// <param name="TokensUsedLastWeek">Tokens spent in the trailing week.</param>
/// <param name="JobsTotal">Sessions over all time.</param>
/// <param name="TokensUsedTotal">Tokens spent over all time.</param>
[ReadModel]
[Passive]
public record AIProviderUsage(
    AIProviderId ProviderId,
    int JobsLastWeek,
    long TokensUsedLastWeek,
    int JobsTotal,
    long TokensUsedTotal)
{
    /// <summary>
    /// Totals every provider's recorded usage.
    /// </summary>
    /// <param name="sessions">The recorded agent sessions.</param>
    /// <param name="timeProvider">The clock the trailing week is measured back from.</param>
    /// <returns>Usage per provider, heaviest first.</returns>
    /// <remarks>
    /// Read in a single pass rather than as two queries: the trailing week is a subset of all time,
    /// so asking twice would scan the same sessions twice and could disagree with itself if a
    /// session were recorded between the two reads.
    /// </remarks>
    public static async Task<IEnumerable<AIProviderUsage>> AllAIProviderUsage(IRecordedAgentSessions sessions, TimeProvider timeProvider)
    {
        var weekCutoff = timeProvider.GetUtcNow() - TimeSpan.FromDays(7);
        var recorded = await sessions.RecordedSince(DateTimeOffset.MinValue);

        return recorded
            .Where(session => session.ProviderId is not null)
            .GroupBy(session => session.ProviderId!)
            .Select(group => new AIProviderUsage(
                group.Key,
                group.Count(session => session.Occurred >= weekCutoff),
                group.Where(session => session.Occurred >= weekCutoff).Sum(session => session.InputTokens + session.OutputTokens),
                group.Count(),
                group.Sum(session => session.InputTokens + session.OutputTokens)))
            .OrderByDescending(usage => usage.TokensUsedTotal);
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Usage.Daily;

/// <summary>
/// Reads recorded agent sessions for <see cref="AgentUsageByDay.LastYear"/> to bucket - the seam that
/// lets the query stay a plain, testable aggregation over an in-memory shape rather than embedding a
/// Chronicle read-model query directly (mirrors Direct's own <c>IRecordedWork</c>/<c>ILanguageModelJobs</c> split).
/// </summary>
public interface IRecordedAgentSessions
{
    /// <summary>
    /// Gets every agent session recorded since a point in time.
    /// </summary>
    /// <param name="since">The cutoff.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The recorded sessions.</returns>
    Task<IEnumerable<RecordedAgentSession>> RecordedSince(DateTimeOffset since, CancellationToken cancellationToken = default);
}

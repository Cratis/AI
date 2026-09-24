// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reactive.Subjects;
using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Providers.UsageReporting.RecordingSnapshot;
using MongoDB.Driver;

namespace Cratis.AI.Providers.UsageReporting.Snapshots;

/// <summary>
/// Read model for a configured AI provider's most recently refreshed usage level - the audit trail
/// and live Settings-panel surface for capacity-aware pool selection (issue #1061). Unlike
/// <see cref="AIProviderUsageReport"/> (asked live, per query), this is the level selection actually
/// ranked members by the last time it refreshed the pool - materialized so the panel can list every
/// pool member's level in one query rather than asking the vendor again just to display it.
/// </summary>
/// <param name="Id">The provider the snapshot is for.</param>
/// <param name="Availability">Why the vendor-reported usage was or was not available at the last refresh.</param>
/// <param name="ConsumedTokens">The tokens counted as consumed at the last refresh - vendor-reported where <paramref name="Availability"/> is <see cref="AIUsageReportAvailability.Available"/>, Direct's own trailing-week burn otherwise.</param>
/// <param name="UsedLocalBurnFallback">Whether <paramref name="ConsumedTokens"/> came from Direct's own trailing-week burn rather than the vendor's usage report.</param>
/// <param name="RecordedAt">When this level was refreshed - <see langword="null"/> only for the instant between creation and the projection setting it from the same event.</param>
[ReadModel]
[FromEvent<AIProviderUsageSnapshotRecorded>]
public record AIProviderUsageSnapshot(
    AIProviderId Id,
    [SetFrom<AIProviderUsageSnapshotRecorded>(nameof(AIProviderUsageSnapshotRecorded.Availability))]
    AIUsageReportAvailability Availability,
    [SetFrom<AIProviderUsageSnapshotRecorded>(nameof(AIProviderUsageSnapshotRecorded.ConsumedTokens))]
    long ConsumedTokens,
    [SetFrom<AIProviderUsageSnapshotRecorded>(nameof(AIProviderUsageSnapshotRecorded.UsedLocalBurnFallback))]
    bool UsedLocalBurnFallback,
    [SetFromContext<AIProviderUsageSnapshotRecorded>(nameof(EventContext.Occurred))]
    DateTimeOffset? RecordedAt = null)
{
    /// <summary>
    /// Observes every provider's most recently refreshed usage level.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the snapshots.</param>
    /// <returns>An observable of every provider's usage snapshot.</returns>
    public static ISubject<IEnumerable<AIProviderUsageSnapshot>> AllAIProviderUsageSnapshots(IMongoCollection<AIProviderUsageSnapshot> collection) =>
        collection.Observe();
}

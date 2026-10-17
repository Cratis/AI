// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reactive;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Providers.UsageReporting.RecordingSnapshot;

namespace Cratis.AI.Providers.UsageReporting.Snapshots;

/// <summary>
/// A configured AI provider's most recently refreshed in-memory usage level.
/// The legacy projection remains registered for replay, but the live query reads the cache.
/// </summary>
/// <param name="Id">The provider the snapshot is for.</param>
/// <param name="Availability">Why the vendor-reported usage was or was not available at the last refresh.</param>
/// <param name="ConsumedTokens">The tokens counted as consumed at the last refresh - vendor-reported where <paramref name="Availability"/> is <see cref="AIUsageReportAvailability.Available"/>, Direct's own trailing-week burn otherwise.</param>
/// <param name="UsedLocalBurnFallback">Whether <paramref name="ConsumedTokens"/> came from Direct's own trailing-week burn rather than the vendor's usage report.</param>
/// <param name="RecordedAt">When this level was refreshed - <see langword="null"/> only for the instant between creation and the projection setting it from the same event.</param>
[ReadModel]

// Retain the legacy projection until the next major release for existing stores.
#pragma warning disable CS0618
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
#pragma warning restore CS0618
{
    /// <summary>
    /// Observes every provider's most recently refreshed usage level.
    /// </summary>
    /// <param name="snapshots">The process-wide latest readings.</param>
    /// <param name="readModels">The current namespace's configured providers.</param>
    /// <returns>An observable of the current namespace's provider usage snapshots.</returns>
    public static ISubject<IEnumerable<AIProviderUsageSnapshot>> AllAIProviderUsageSnapshots(IRecentUsageSnapshots snapshots, IReadModels readModels)
    {
        // Arc disposes Subscribe's result, not the subject itself. Keep the cache subscription
        // inside the observable chain so HTTP, SSE and WebSocket teardown release it.
        var visible = snapshots.Observe()
            .Select(readings => Observable.FromAsync(() => NamespaceVisibleSnapshots.Filter(readings, readModels)))
            .Concat();

        return Subject.Create<IEnumerable<AIProviderUsageSnapshot>>(Observer.Create<IEnumerable<AIProviderUsageSnapshot>>(_ => { }), visible);
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;

namespace Cratis.AI.Providers.UsageReporting.RecordingSnapshot;

/// <summary>
/// Command for recording a provider's usage level at the moment it was refreshed for a pool
/// selection - the one place that appends <see cref="AIProviderUsageSnapshotRecorded"/>, so a
/// capacity-aware selection decision is auditable and the Settings pool panel has a live surface to
/// show (issue #1061). Raised by <see cref="IProviderUsageLevels"/> for every provider it actually
/// refreshes; a provider answered from its own freshness cache is not re-recorded.
/// </summary>
/// <param name="Provider">The provider the usage level was refreshed for - its own identity resolves the event source.</param>
/// <param name="Availability">Why the vendor-reported usage was or was not available for this refresh.</param>
/// <param name="ConsumedTokens">The tokens counted as consumed - vendor-reported where <paramref name="Availability"/> is <see cref="AIUsageReportAvailability.Available"/>, Direct's own trailing-week burn otherwise.</param>
/// <param name="UsedLocalBurnFallback">Whether <paramref name="ConsumedTokens"/> came from Direct's own trailing-week burn rather than the vendor's usage report.</param>
[Command]
public record RecordAIProviderUsageSnapshot(AIProviderId Provider, AIUsageReportAvailability Availability, long ConsumedTokens, bool UsedLocalBurnFallback)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AIProviderUsageSnapshotRecorded"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AIProviderUsageSnapshotRecorded Handle() => new(Availability, ConsumedTokens, UsedLocalBurnFallback);
}

/// <summary>
/// Event raised when a provider's usage level has been refreshed ahead of a selection decision - the
/// audit trail for capacity-aware pool selection (issue #1061).
/// </summary>
/// <param name="Availability">Why the vendor-reported usage was or was not available for this refresh.</param>
/// <param name="ConsumedTokens">The tokens counted as consumed - vendor-reported where <paramref name="Availability"/> is <see cref="AIUsageReportAvailability.Available"/>, Direct's own trailing-week burn otherwise.</param>
/// <param name="UsedLocalBurnFallback">Whether <paramref name="ConsumedTokens"/> came from Direct's own trailing-week burn rather than the vendor's usage report.</param>
[EventType]
public record AIProviderUsageSnapshotRecorded(AIUsageReportAvailability Availability, long ConsumedTokens, bool UsedLocalBurnFallback);

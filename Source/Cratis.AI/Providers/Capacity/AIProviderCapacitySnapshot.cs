// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Availability of information, not permission to start work. Known exhaustion is available information.
/// </summary>
public enum AIProviderCapacitySnapshotState
{
    /// <summary>No allowance is known.</summary>
    Unavailable = 0,

    /// <summary>The observation is current.</summary>
    Available = 1,

    /// <summary>The last observation is retained but no longer current.</summary>
    Stale = 2
}

/// <summary>
/// Fixed explanations safe to persist; never vendor problems or credentials.
/// </summary>
public enum AIProviderCapacitySnapshotReason
{
    /// <summary>No problem is known.</summary>
    None = 0,

    /// <summary>No provider was resolved.</summary>
    ProviderNotResolved = 1,

    /// <summary>No cached observation exists.</summary>
    NotObserved = 2,

    /// <summary>The custom cache does not support cache-only capture.</summary>
    CacheNotSupported = 3,

    /// <summary>A refresh failed.</summary>
    RefreshFailed = 4,

    /// <summary>The observation exceeded its freshness window.</summary>
    Expired = 5,

    /// <summary>The observation was invalidated.</summary>
    Invalidated = 6,

    /// <summary>A reported reset has passed since observation.</summary>
    ResetElapsed = 7,

    /// <summary>The capture itself failed.</summary>
    CaptureFailed = 8
}

/// <summary>
/// A historical observation of provider-wide allowance, not consumption attributable to a task.
/// </summary>
/// <param name="Provider">The actual provider, or <see cref="AIProviderId.NotSet"/> if unresolved.</param>
/// <param name="Source">Where the allowance came from.</param>
/// <param name="State">Whether the observation is available, stale or unavailable.</param>
/// <param name="Reason">A sanitized explanation of its state.</param>
/// <param name="CapturedAt">When this boundary copied the observation.</param>
/// <param name="ObservedAt">When the allowance was originally observed, or <see cref="UnknownTime"/>.</param>
/// <param name="Windows">Every observed allowance window; empty does not imply full headroom.</param>
public record AIProviderCapacitySnapshot(
    AIProviderId Provider,
    AIProviderCapacitySource Source,
    AIProviderCapacitySnapshotState State,
    AIProviderCapacitySnapshotReason Reason,
    DateTimeOffset CapturedAt,
    DateTimeOffset ObservedAt,
    IReadOnlyList<AIProviderAllowanceWindow> Windows)
{
    /// <summary>
    /// The sentinel for an absent observation time or an unknown reset time.
    /// </summary>
    public static readonly DateTimeOffset UnknownTime = DateTimeOffset.MinValue;

    /// <summary>
    /// Creates an unavailable observation without inventing allowance or an observation time.
    /// </summary>
    /// <param name="provider">The actual provider.</param>
    /// <param name="capturedAt">The boundary time.</param>
    /// <param name="reason">The sanitized reason.</param>
    /// <returns>The unavailable snapshot.</returns>
    public static AIProviderCapacitySnapshot Unavailable(AIProviderId provider, DateTimeOffset capturedAt, AIProviderCapacitySnapshotReason reason) =>
        new(provider, AIProviderCapacitySource.Unknown, AIProviderCapacitySnapshotState.Unavailable, reason, capturedAt, UnknownTime, []);
}

/// <summary>
/// An immutable copy of one raw allowance window. Passed resets never manufacture new headroom.
/// </summary>
/// <param name="Kind">The window kind.</param>
/// <param name="Name">The window's label.</param>
/// <param name="Remaining">The remaining fraction, clamped from zero to one.</param>
/// <param name="ResetsAt">The reported reset, or <see cref="AIProviderCapacitySnapshot.UnknownTime"/>.</param>
public record AIProviderAllowanceWindow(UsageWindowKind Kind, string Name, double Remaining, DateTimeOffset ResetsAt);

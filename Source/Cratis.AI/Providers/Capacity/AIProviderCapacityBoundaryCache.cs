// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// An optional cache-only view on the existing singleton, never a separately resolved DI alias.
/// </summary>
internal interface IAIProviderCapacityObservationView
{
    /// <summary>
    /// Reads an immutable observation without waiting for writers or refreshes.
    /// </summary>
    /// <param name="provider">The actual provider.</param>
    /// <returns>The cached observation, if any.</returns>
    AIProviderCapacityBoundaryCache.Cached? ReadCached(AIProviderId provider);
}

/// <summary>
/// Separate from vendor caching/backoff: selecting a fallback must never replace a vendor entry.
/// </summary>
internal sealed class AIProviderCapacityBoundaryCache
{
    readonly ConcurrentDictionary<AIProviderId, Slot> _slots = new();

    /// <summary>
    /// Creates the shared, in-memory-only account identity; never included in events.
    /// </summary>
    /// <param name="credential">The credential material.</param>
    /// <returns>The fingerprint.</returns>
    internal static string Fingerprint(string credential) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(credential)));

    /// <summary>
    /// Selects a new publication version, clearing observations when the account changes.
    /// </summary>
    /// <param name="provider">The actual provider.</param>
    /// <param name="credential">The credential material, or null to retain the current identity.</param>
    /// <returns>The publication ticket.</returns>
    internal Ticket Begin(AIProviderId provider, string? credential)
    {
        var slot = _slots.GetOrAdd(provider, static _ => new());
        lock (slot.Gate)
        {
            var fingerprint = credential is null ? slot.Fingerprint : Fingerprint(credential);
            if (fingerprint != slot.Fingerprint)
            {
                Volatile.Write(ref slot.Cached, null);
                slot.Fingerprint = fingerprint;
            }

            return new(slot, ++slot.Version, fingerprint);
        }
    }

    /// <summary>
    /// Publishes only if both the selection and the original read's account still match.
    /// </summary>
    /// <param name="ticket">The selected query's version.</param>
    /// <param name="observation">The selected observation.</param>
    /// <param name="reason">The sanitized state reason.</param>
    /// <param name="fingerprint">The account identity of the original read.</param>
    internal void Remember(Ticket ticket, AIProviderCapacityObservation observation, AIProviderCapacitySnapshotReason reason, string? fingerprint)
    {
        var slot = ticket.Slot;
        lock (slot.Gate)
        {
            if (ticket.Version != slot.Version || fingerprint != slot.Fingerprint)
            {
                return;
            }

            // Copy the raw windows now, before a reporter can mutate its list.
            var copy = observation with { Report = observation.Report with { Windows = observation.Report.Windows.ToArray(), Problem = null } };
            Volatile.Write(ref slot.Cached, new(copy, reason));
        }
    }

    /// <summary>
    /// Reads the atomically published immutable observation, without taking the writer lock.
    /// </summary>
    /// <param name="provider">The actual provider.</param>
    /// <returns>The cached observation.</returns>
    internal Cached? Read(AIProviderId provider)
    {
        if (!_slots.TryGetValue(provider, out var slot))
        {
            return null;
        }

        return Volatile.Read(ref slot.Cached);
    }

    /// <summary>
    /// Invalidates pending publications and either retains stale facts or clears removed providers.
    /// </summary>
    /// <param name="provider">The actual provider.</param>
    /// <param name="clear">Whether the provider is no longer known.</param>
    internal void Invalidate(AIProviderId provider, bool clear = false)
    {
        var slot = _slots.GetOrAdd(provider, static _ => new());
        lock (slot.Gate)
        {
            slot.Version++;
            var cached = slot.Cached;
            Volatile.Write(ref slot.Cached, clear ? null : cached is null ? null : cached with { Reason = AIProviderCapacitySnapshotReason.Invalidated });
        }
    }

    /// <summary>
    /// Immutable allowance and state metadata published together.
    /// </summary>
    /// <param name="Observation">The allowance observation.</param>
    /// <param name="Reason">The sanitized state.</param>
    internal sealed record Cached(AIProviderCapacityObservation Observation, AIProviderCapacitySnapshotReason Reason);

    /// <summary>
    /// A selected query's publication authority, not part of a persisted snapshot.
    /// </summary>
    /// <param name="Slot">The provider's slot.</param>
    /// <param name="Version">The selected query's version.</param>
    /// <param name="Fingerprint">The selected account's identity.</param>
    internal sealed record Ticket(Slot Slot, long Version, string? Fingerprint);

    /// <summary>
    /// A provider's writer state and atomically readable observation.
    /// </summary>
    internal sealed class Slot
    {
        /// <summary>
        /// The immutable observation reference; accessed atomically by readers and writers.
        /// </summary>
        internal Cached? Cached;

        /// <summary>
        /// Serializes writers only, never boundary readers.
        /// </summary>
        internal Lock Gate { get; } = new();

        /// <summary>
        /// The latest publication version.
        /// </summary>
        internal long Version { get; set; }

        /// <summary>
        /// The selected account's fingerprint, never persisted.
        /// </summary>
        internal string? Fingerprint { get; set; }
    }
}

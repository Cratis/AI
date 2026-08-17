// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Collections.ObjectModel;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Hashing;

namespace Cratis.Factory.Definitions;

/// <summary>
/// Identifies the deterministic execution kind of a compiled workflow phase.
/// </summary>
public enum WorkflowPhaseKind
{
    /// <summary>An unsupported phase kind.</summary>
    Unknown = 0,

    /// <summary>A human decision phase.</summary>
    Human = 1,

    /// <summary>A bounded agent judgment phase.</summary>
    Agent = 2,

    /// <summary>A deterministic code phase.</summary>
    Code = 3
}

/// <summary>
/// Describes one phase in deterministic topological order.
/// </summary>
public sealed class CompiledPhaseDescriptor
{
    internal CompiledPhaseDescriptor(string id, int ordinal, WorkflowPhaseKind kind, IEnumerable<string> needs)
    {
        Id = id;
        Ordinal = ordinal;
        Kind = kind;
        Needs = new ReadOnlyCollection<string>([.. needs]);
    }

    /// <summary>Gets the phase identifier.</summary>
    public string Id { get; }

    /// <summary>Gets the zero-based deterministic ordinal.</summary>
    public int Ordinal { get; }

    /// <summary>Gets the phase execution kind.</summary>
    public WorkflowPhaseKind Kind { get; }

    /// <summary>Gets the immutable ordinally sorted dependency identifiers.</summary>
    public IReadOnlyList<string> Needs { get; }
}

/// <summary>
/// Represents the immutable normalized output of successful definition and workflow compilation.
/// </summary>
public sealed class CompiledWorkflow
{
    readonly byte[] _utf8;

    internal CompiledWorkflow(
        string id,
        string version,
        Sha256Hash sourceContentHash,
        Sha256Hash contentHash,
        IEnumerable<CompiledPhaseDescriptor> orderedPhases,
        IEnumerable<string> requiredGateIds,
        string successPhase,
        CanonicalJsonValue normalized)
    {
        Id = id;
        Version = version;
        SourceContentHash = sourceContentHash;
        ContentHash = contentHash;
        OrderedPhases = new ReadOnlyCollection<CompiledPhaseDescriptor>([.. orderedPhases]);
        RequiredGateIds = new ReadOnlyCollection<string>([.. requiredGateIds]);
        SuccessPhase = successPhase;
        Normalized = normalized;
        _utf8 = normalized.ToArray();
    }

    /// <summary>Gets the selected workflow identifier.</summary>
    public string Id { get; }

    /// <summary>Gets the selected workflow version.</summary>
    public string Version { get; }

    /// <summary>Gets the canonical hash of the source workflow definition.</summary>
    public Sha256Hash SourceContentHash { get; }

    /// <summary>Gets the normalized pre-self-hash content hash.</summary>
    public Sha256Hash ContentHash { get; }

    /// <summary>Gets the phases in deterministic topological order.</summary>
    public IReadOnlyList<CompiledPhaseDescriptor> OrderedPhases { get; }

    /// <summary>Gets the ordinally sorted required acceptance gate identifiers.</summary>
    public IReadOnlyList<string> RequiredGateIds { get; }

    /// <summary>Gets the terminal success phase identifier.</summary>
    public string SuccessPhase { get; }

    /// <summary>Gets the complete immutable canonical normalized value.</summary>
    public CanonicalJsonValue Normalized { get; }

    /// <summary>Gets a read-only view of the normalized canonical bytes.</summary>
    public ReadOnlySpan<byte> Utf8 => _utf8;

    /// <summary>
    /// Creates a fresh copy of the normalized canonical bytes.
    /// </summary>
    /// <returns>A new byte array.</returns>
    public byte[] ToArray() => [.. _utf8];

    /// <summary>
    /// Writes the complete normalized bytes to a caller-owned buffer.
    /// </summary>
    /// <param name="destination">The destination buffer.</param>
    /// <exception cref="ArgumentNullException">Thrown when <paramref name="destination"/> is null.</exception>
    public void WriteTo(IBufferWriter<byte> destination)
    {
        ArgumentNullException.ThrowIfNull(destination);
        destination.Write(_utf8);
    }
}

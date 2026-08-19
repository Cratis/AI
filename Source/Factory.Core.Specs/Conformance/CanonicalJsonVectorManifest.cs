// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Conformance;

sealed record CanonicalJsonVectorManifest(
    string ProtocolVersion,
    string Algorithm,
    string ContentHash,
    string Description,
    CanonicalJsonVectorLimits Limits,
    IReadOnlyDictionary<string, string> GeneratorContract,
    IReadOnlyList<CanonicalJsonVector> Cases);

sealed record CanonicalJsonVectorLimits(
    int MaximumInputBytes,
    int MaximumOutputBytes,
    int MaximumDepth,
    int MaximumStringScalars,
    int MaximumKeyScalars,
    int MaximumStructuralPunctuationTokens,
    int MaximumArrayItems,
    int MaximumObjectMembers);

sealed record CanonicalJsonVector(
    string Id,
    string Operation,
    CanonicalJsonVectorExpected Expected,
    string? InputBase64 = null,
    CanonicalJsonVectorGenerator? Generator = null,
    string? Mode = null,
    int RepeatCount = 1,
    int? AllocationCeilingBytes = null,
    string? EquivalenceGroup = null,
    string? DistinctFromGroup = null,
    IReadOnlyList<string>? ForbiddenErrorSubstrings = null,
    IReadOnlyList<string>? Flags = null,
    string? SourceHint = null,
    string? ProjectionHint = null);

sealed record CanonicalJsonVectorExpected(
    bool Accepted,
    string? CanonicalBase64 = null,
    int? CanonicalByteLength = null,
    string? CanonicalHash = null,
    string? ByteHash = null,
    string? SelfHash = null,
    string? DeclaredHash = null,
    string? VerificationStatus = null,
    string? CalculationError = null,
    string? ErrorCode = null,
    int? Position = null,
    int? Depth = null);

sealed record CanonicalJsonVectorGenerator
{
    public string Kind { get; init; } = string.Empty;
    public string? Scalar { get; init; }
    public int? ScalarCount { get; init; }
    public string? KeyScalar { get; init; }
    public int? KeyScalarCount { get; init; }
    public int? Count { get; init; }
    public string? KeyPrefix { get; init; }
    public int? KeyDigits { get; init; }
    public int? Depth { get; init; }
    public int? LeadingWhitespaceCount { get; init; }
    public string? ValueBase64 { get; init; }
    public string? AScalar { get; init; }
    public int? AScalarCount { get; init; }
    public string? BScalar { get; init; }
    public int? BScalarCount { get; init; }
    public string? HashField { get; init; }
    public string? PayloadScalar { get; init; }
    public int? PayloadScalarCount { get; init; }
}

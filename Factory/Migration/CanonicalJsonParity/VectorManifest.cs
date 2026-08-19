// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.CanonicalJsonParity;

sealed record VectorManifest(
    string? ProtocolVersion,
    string? Algorithm,
    string? Description,
    VectorGeneratorContract? GeneratorContract,
    VectorLimits? Limits,
    VectorCase?[]? Cases,
    string? ContentHash);

sealed record VectorGeneratorContract(
    string? RepeatedString,
    string? SinglePropertyObject,
    string? ArrayOfNulls,
    string? ObjectWithNullMembers,
    string? NestedArrays,
    string? PaddedValue,
    string? TwoStringObject,
    string? SelfHashObject,
    string? ObjectWithOneEmptyObjectMember,
    string? ArrayWithOneEmptyArrayItem);

sealed record VectorLimits(
    int? MaximumInputBytes,
    int? MaximumOutputBytes,
    int? MaximumDepth,
    int? MaximumStringScalars,
    int? MaximumKeyScalars,
    int? MaximumStructuralPunctuationTokens,
    int? MaximumArrayItems,
    int? MaximumObjectMembers);

sealed record VectorCase(
    string? Id,
    string? Operation,
    string? Mode,
    string? InputBase64,
    VectorGenerator? Generator,
    VectorExpectation? Expected,
    int? RepeatCount,
    string[]? Flags,
    int? AllocationCeilingBytes,
    string? DistinctFromGroup,
    string? EquivalenceGroup,
    string? ProjectionHint,
    string? SourceHint,
    string[]? ForbiddenErrorSubstrings);

sealed record VectorExpectation(
    bool? Accepted,
    string? CanonicalBase64,
    int? CanonicalByteLength,
    string? CanonicalHash,
    string? ByteHash,
    string? SelfHash,
    string? DeclaredHash,
    string? VerificationStatus,
    string? CalculationError,
    string? ErrorCode,
    int? Position,
    int? Depth);

sealed record VectorGenerator(
    string? Kind,
    string? Scalar,
    int? ScalarCount,
    string? KeyScalar,
    int? KeyScalarCount,
    int? Count,
    string? KeyPrefix,
    int? KeyDigits,
    int? Depth,
    int? LeadingWhitespaceCount,
    string? ValueBase64,
    string? AScalar,
    int? AScalarCount,
    string? BScalar,
    int? BScalarCount,
    string? HashField,
    string? PayloadScalar,
    int? PayloadScalarCount);

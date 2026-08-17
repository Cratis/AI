// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidationParity;

sealed record VectorManifest(
    string? ProtocolVersion,
    string? Algorithm,
    string? ContentHash,
    string? Description,
    VectorLimits? Limits,
    IReadOnlyDictionary<string, string>? GeneratorContract,
    IReadOnlyDictionary<string, VectorDocument>? Documents,
    IReadOnlyList<VectorCase?>? Cases);

sealed record VectorLimits(
    int? MaximumDocuments,
    int? MaximumAggregateSchemaBytes,
    int? MaximumResources,
    int? MaximumAnchors,
    int? MaximumReferenceEdges,
    int? MaximumReferenceDepth,
    int? MaximumSchemaNodes,
    int? MaximumInstanceNodes,
    int? MaximumEvaluationWorkUnits,
    int? MaximumDiagnosticInstanceNodes,
    int? MaximumDiagnosticWorkUnits,
    int? MaximumDiagnostics,
    int? MaximumPatternScalars,
    int? MaximumSchemaIdScalars,
    int? MaximumReferenceScalars,
    int? MaximumAnchorScalars);

sealed record VectorCase(
    string? Id,
    string? Operation,
    IReadOnlyList<string>? SchemaDocuments,
    VectorGenerator? SchemaGenerator,
    string? RootSchemaId,
    string? InstanceBase64,
    VectorGenerator? InstanceGenerator,
    int? RepeatCount,
    int? ParallelCount,
    VectorExpected? Expected,
    IReadOnlyList<string>? Flags,
    IReadOnlyList<string>? ForbiddenDiagnosticSubstrings);

sealed record VectorDocument(string? LogicalId, string? InputBase64);

sealed record VectorGenerator(
    string? Kind,
    int? Count,
    string? SchemaIdPrefix,
    int? TargetBytes);

sealed record VectorExpected(
    string? LoadStatus,
    VectorSet? SchemaSet,
    string? ValidationStatus,
    VectorClosure? Closure,
    IReadOnlyList<VectorDiagnostic?>? Diagnostics);

sealed record VectorSet(
    string? Identity,
    IReadOnlyList<VectorMember?>? Documents,
    IReadOnlyList<VectorResource?>? Resources,
    int? ResourceCount,
    int? AnchorCount,
    int? ReferenceCount);

sealed record VectorClosure(
    string? RootSchemaId,
    string? Identity,
    IReadOnlyList<VectorMember?>? Members,
    int? ResourceCount,
    int? AnchorCount,
    int? ReferenceCount);

sealed record VectorMember(
    string? SchemaId,
    string? ContentHash,
    int? ReferenceCount);

sealed record VectorResource(
    string? SchemaId,
    string? DocumentId,
    string? ContentHash,
    int? ReferenceCount);

sealed record VectorDiagnostic(
    string? Code,
    string? Severity,
    string? Status,
    string? SchemaId,
    string? InstanceLocation,
    string? KeywordLocation);

sealed record VectorSchemaDocument(string LogicalId, byte[] Utf8);

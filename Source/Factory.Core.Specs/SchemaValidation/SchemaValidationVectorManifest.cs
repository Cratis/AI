// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation.Conformance;

sealed record SchemaValidationVectorManifest(
    string ProtocolVersion,
    string Algorithm,
    string ContentHash,
    string Description,
    SchemaValidationVectorLimits Limits,
    IReadOnlyDictionary<string, string> GeneratorContract,
    IReadOnlyDictionary<string, SchemaValidationVectorDocument> Documents,
    IReadOnlyList<SchemaValidationVector> Cases);

sealed record SchemaValidationVectorLimits(
    int MaximumDocuments,
    int MaximumAggregateSchemaBytes,
    int MaximumResources,
    int MaximumAnchors,
    int MaximumReferenceEdges,
    int MaximumReferenceDepth,
    int MaximumSchemaNodes,
    int MaximumInstanceNodes,
    int MaximumEvaluationWorkUnits,
    int MaximumDiagnosticInstanceNodes,
    int MaximumDiagnosticWorkUnits,
    int MaximumDiagnostics,
    int MaximumPatternScalars,
    int MaximumSchemaIdScalars,
    int MaximumReferenceScalars,
    int MaximumAnchorScalars);

sealed record SchemaValidationVector(
    string Id,
    string Operation,
    IReadOnlyList<string>? SchemaDocuments,
    SchemaValidationVectorGenerator? SchemaGenerator,
    string? RootSchemaId,
    string? InstanceBase64,
    SchemaValidationVectorGenerator? InstanceGenerator,
    int RepeatCount,
    int ParallelCount,
    SchemaValidationVectorExpected Expected,
    IReadOnlyList<string> Flags,
    IReadOnlyList<string> ForbiddenDiagnosticSubstrings);

sealed record SchemaValidationVectorDocument(string LogicalId, string InputBase64);

sealed record SchemaValidationVectorGenerator(
    string Kind,
    int Count,
    string? SchemaIdPrefix,
    int? TargetBytes);

sealed record SchemaValidationVectorExpected(
    string LoadStatus,
    SchemaValidationVectorSet? SchemaSet,
    string? ValidationStatus,
    SchemaValidationVectorClosure? Closure,
    IReadOnlyList<SchemaValidationVectorDiagnostic> Diagnostics);

sealed record SchemaValidationVectorSet(
    string Identity,
    IReadOnlyList<SchemaValidationVectorMember> Documents,
    IReadOnlyList<SchemaValidationVectorResource> Resources,
    int ResourceCount,
    int AnchorCount,
    int ReferenceCount);

sealed record SchemaValidationVectorClosure(
    string RootSchemaId,
    string Identity,
    IReadOnlyList<SchemaValidationVectorMember> Members,
    int ResourceCount,
    int AnchorCount,
    int ReferenceCount);

sealed record SchemaValidationVectorMember(
    string SchemaId,
    string ContentHash,
    int ReferenceCount);

sealed record SchemaValidationVectorResource(
    string SchemaId,
    string DocumentId,
    string ContentHash,
    int ReferenceCount);

sealed record SchemaValidationVectorDiagnostic(
    string Code,
    string Severity,
    string Status,
    string? SchemaId,
    string InstanceLocation,
    string KeywordLocation);

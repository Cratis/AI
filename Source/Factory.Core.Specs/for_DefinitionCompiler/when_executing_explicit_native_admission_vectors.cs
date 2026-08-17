// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Definitions;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.for_DefinitionCompiler;

public class when_executing_explicit_native_admission_vectors : given_an_accepted_definition_schema_set
{
    readonly List<string> _failures = [];
    int _vectorCount;

    void Because()
    {
        var artifact = Native("artifact", DefinitionKind.ArtifactDescriptor);
        var otherSchemas = SchemaResourceSet.Load(
            [new SchemaDocument("https://schemas.example.test/other.schema.json", "true"u8)]).ResourceSet;
        var evaluationCatalog = Catalog(CapabilityCatalog(
            "evaluation-limit",
            [.. Enumerable.Range(0, 256).Select(index => Capability($"capability-{index:0000}", ["agent"]))]),
            "evaluation-limit-catalog");

        var vectors = new NativeAdmissionVector[]
        {
            new("schema-set-required", DefinitionCompiler.Compile(null, [artifact], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.SchemaSetRequired, 1),
            new("schema-set-not-accepted", DefinitionCompiler.Compile(otherSchemas, [artifact], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.SchemaSetNotAccepted, 1),
            new("invalid-workflow-id", DefinitionCompiler.Compile(Schemas, [artifact], "BAD"), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.InvalidWorkflowId, 1),
            new("no-definitions-null", DefinitionCompiler.Compile(Schemas, null, WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.NoDefinitions, 1),
            new("no-definitions-empty", DefinitionCompiler.Compile(Schemas, [], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.NoDefinitions, 1),
            new("definition-count", DefinitionCompiler.Compile(Schemas, Enumerable.Repeat(artifact, 257), WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.DefinitionLimitExceeded, 1),
            new("aggregate-bytes", DefinitionCompiler.Compile(Schemas, AggregateDefinitions(), WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.AggregateDefinitionBytesLimitExceeded, 1),
            new("enumeration-failure", DefinitionCompiler.Compile(Schemas, ThrowingDefinitions(artifact), WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.DefinitionEnumerationFailed, 1),
            new("invalid-logical-id", DefinitionCompiler.Compile(Schemas, [new(null, artifact.Kind, artifact.Utf8)], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.InvalidDefinitionLogicalId, 1),
            new("duplicate-logical-id", DefinitionCompiler.Compile(Schemas, [artifact, artifact], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.DuplicateDefinitionLogicalId, 1),
            new("unsupported-kind", DefinitionCompiler.Compile(Schemas, [new("unknown", DefinitionKind.Unknown, "{}"u8)], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.UnsupportedDefinitionKind, 1),
            new("canonical-rejection", DefinitionCompiler.Compile(Schemas, [new("broken", DefinitionKind.ArtifactDescriptor, "{"u8)], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.CanonicalDefinitionRejected, 1),
            new("schema-violation", DefinitionCompiler.Compile(Schemas, [new("invalid", DefinitionKind.ArtifactDescriptor, "{}"u8)], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.DefinitionSchemaViolation, null),
            new("evaluation-limit", DefinitionCompiler.Compile(Schemas, [evaluationCatalog], WorkflowId), DefinitionCompilationStatus.EvaluationLimitExceeded, DefinitionDiagnosticCode.DefinitionEvaluationLimitExceeded, 1),
            new("workflow-not-found", DefinitionCompiler.Compile(Schemas, [artifact], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.WorkflowNotFound, 1),
            new("duplicate-workflow-id", DefinitionCompiler.Compile(Schemas, [Workflow(ValidWorkflow(HumanPhase("finish")), "first"), Workflow(ValidWorkflow(HumanPhase("finish")), "second")], WorkflowId), DefinitionCompilationStatus.Rejected, DefinitionDiagnosticCode.DuplicateWorkflowId, 1),
            new("diagnostic-overflow", DefinitionCompiler.Compile(Schemas, OverflowDefinitions(256), WorkflowId), DefinitionCompilationStatus.DiagnosticLimitExceeded, DefinitionDiagnosticCode.DiagnosticLimitExceeded, 256),
            new("evaluation-wins-over-overflow", DefinitionCompiler.Compile(Schemas, [.. OverflowDefinitions(255), evaluationCatalog], WorkflowId), DefinitionCompilationStatus.EvaluationLimitExceeded, DefinitionDiagnosticCode.DiagnosticLimitExceeded, 256)
        };

        _vectorCount = vectors.Length;
        foreach (var vector in vectors)
        {
            if (vector.Result.Status != vector.Status) _failures.Add($"{vector.Id}: status {vector.Result.Status}");
            if (!vector.Result.Diagnostics.Any(_ => _.Code == vector.Code)) _failures.Add($"{vector.Id}: missing {vector.Code}");
            if (vector.DiagnosticCount.HasValue && vector.Result.Diagnostics.Count != vector.DiagnosticCount.Value)
            {
                _failures.Add($"{vector.Id}: diagnostic count {vector.Result.Diagnostics.Count}");
            }
            if (vector.Result.Workflow is not null) _failures.Add($"{vector.Id}: published workflow");
        }
    }

    [Fact] void should_execute_every_explicit_admission_vector() => _vectorCount.ShouldEqual(18);
    [Fact] void should_match_every_explicit_native_fact() => _failures.ShouldBeEmpty();

    static IReadOnlyList<DefinitionDocument> AggregateDefinitions() =>
    [
        new("aggregate-a", DefinitionKind.Unknown, new byte[2_000_000]),
        new("aggregate-b", DefinitionKind.Unknown, new byte[2_000_000]),
        new("aggregate-c", DefinitionKind.Unknown, new byte[2_000_000]),
        new("aggregate-d", DefinitionKind.Unknown, new byte[2_000_001])
    ];

    static IReadOnlyList<DefinitionDocument> OverflowDefinitions(int count) =>
        [.. Enumerable.Range(0, count).Select(index => new DefinitionDocument($"BAD-{index:000}", DefinitionKind.Unknown, "{}"u8))];

    static IEnumerable<DefinitionDocument> ThrowingDefinitions(DefinitionDocument first)
    {
        yield return first;
        throw new NativeEnumerationFailure();
    }

    sealed record NativeAdmissionVector(
        string Id,
        DefinitionCompilationResult Result,
        DefinitionCompilationStatus Status,
        DefinitionDiagnosticCode Code,
        int? DiagnosticCount);

    sealed class NativeEnumerationFailure : Exception;
}

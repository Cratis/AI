// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.Json.Nodes;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Hashing;
using Cratis.Factory.SchemaValidation;

namespace Cratis.Factory.Definitions;

/// <summary>
/// Compiles caller-supplied immutable definition bytes into one deterministic workflow without acquiring authority.
/// </summary>
public static class DefinitionCompiler
{
    const int MaximumDefinitions = 256;
    const int MaximumAggregateDefinitionBytes = 8_000_000;

    /// <summary>
    /// Gets the only schema resource-set identity accepted by this compiler version.
    /// </summary>
    public static Sha256Hash AcceptedSchemaSetIdentity { get; } = Sha256Hash.Parse(AcceptedDefinitionSchemas.Identity);

    /// <summary>
    /// Resolves a closed definition kind to its exact admitted schema resource identifier.
    /// </summary>
    /// <param name="kind">The caller-selected definition kind.</param>
    /// <param name="schemaId">The exact schema identifier when the kind is supported.</param>
    /// <returns><see langword="true"/> when the kind is supported; otherwise, <see langword="false"/>.</returns>
    public static bool TryGetSchemaId(DefinitionKind kind, [NotNullWhen(true)] out string? schemaId)
    {
        if (DefinitionSchemaRoutes.All.TryGetValue(kind, out var route))
        {
            schemaId = route.SchemaId;
            return true;
        }

        schemaId = null;
        return false;
    }

    /// <summary>
    /// Admits a bounded definition set and compiles the exact requested workflow.
    /// </summary>
    /// <param name="schemas">An already loaded immutable schema resource set.</param>
    /// <param name="definitions">The immutable definition documents.</param>
    /// <param name="workflowId">The exact workflow body identifier to select.</param>
    /// <returns>A total immutable compilation result.</returns>
    public static DefinitionCompilationResult Compile(
        SchemaResourceSet? schemas,
        IEnumerable<DefinitionDocument>? definitions,
        string? workflowId)
    {
        if (schemas is null)
        {
            return RejectEarly(DefinitionDiagnosticCode.SchemaSetRequired, "schema-set", string.Empty, null, string.Empty);
        }
        if (!AcceptedDefinitionSchemas.IsEquivalent(schemas))
        {
            return RejectEarly(DefinitionDiagnosticCode.SchemaSetNotAccepted, "schema-set", string.Empty, schemas.Identity, string.Empty);
        }
        if (!IsSafeIdentifier(workflowId))
        {
            return RejectEarly(DefinitionDiagnosticCode.InvalidWorkflowId, "workflow-id", string.Empty, schemas.Identity, string.Empty);
        }

        var safeWorkflowId = workflowId!;
        var collection = Collect(definitions);
        if (collection.EnumerationFailed)
        {
            return RejectEarly(DefinitionDiagnosticCode.DefinitionEnumerationFailed, "definitions", string.Empty, schemas.Identity, safeWorkflowId);
        }
        if (collection.Documents.Count == 0 && !collection.LimitExceeded)
        {
            return RejectEarly(DefinitionDiagnosticCode.NoDefinitions, "definitions", string.Empty, schemas.Identity, safeWorkflowId);
        }
        if (collection.LimitExceeded)
        {
            var limits = new DefinitionDiagnosticCollection();
            if (collection.DefinitionLimitExceeded)
            {
                limits.Add(DefinitionDiagnosticCode.DefinitionLimitExceeded, location: "definitions");
            }
            if (collection.AggregateBytesLimitExceeded)
            {
                limits.Add(DefinitionDiagnosticCode.AggregateDefinitionBytesLimitExceeded, location: "definitions");
            }
            return Result(limits, safeWorkflowId, schemas.Identity, null, [], null);
        }

        var diagnostics = new DefinitionDiagnosticCollection();
        var admitted = Admit(schemas, collection.Documents, diagnostics);
        if (diagnostics.HasDiagnostics || diagnostics.Overflowed || diagnostics.EvaluationLimitExceeded)
        {
            return Result(diagnostics, safeWorkflowId, schemas.Identity, null, [], null);
        }

        var ordered = admitted
            .OrderBy(_ => _.Descriptor.LogicalId, StringComparer.Ordinal)
            .ThenBy(_ => (int)_.Descriptor.Kind)
            .ToArray();
        var descriptors = ordered.Select(_ => _.Descriptor).ToArray();
        var definitionSetIdentity = CalculateDefinitionSetIdentity(descriptors);
        var workflows = ordered
            .Where(_ => _.Descriptor.Kind is DefinitionKind.Workflow &&
                        string.Equals(_.Value.RootElement.GetProperty("id").GetString(), safeWorkflowId, StringComparison.Ordinal))
            .ToArray();
        if (workflows.Length == 0)
        {
            diagnostics.Add(DefinitionDiagnosticCode.WorkflowNotFound, location: "workflow-id", relatedId: safeWorkflowId);
            return Result(diagnostics, safeWorkflowId, schemas.Identity, definitionSetIdentity, descriptors, null);
        }
        if (workflows.Length > 1)
        {
            diagnostics.Add(DefinitionDiagnosticCode.DuplicateWorkflowId, location: "workflow", relatedId: safeWorkflowId);
            return Result(diagnostics, safeWorkflowId, schemas.Identity, definitionSetIdentity, descriptors, null);
        }

        var workflow = WorkflowSemanticCompiler.Compile(
            schemas,
            ordered,
            workflows[0],
            definitionSetIdentity,
            diagnostics);
        return Result(diagnostics, safeWorkflowId, schemas.Identity, definitionSetIdentity, descriptors, workflow);
    }

    static CollectedDefinitions Collect(IEnumerable<DefinitionDocument>? definitions)
    {
        if (definitions is null)
        {
            return new([], false, false, false, false);
        }

        var documents = new List<CollectedDefinition>();
        var definitionLimit = false;
        var aggregateLimit = false;
        var enumerationFailed = false;
        IEnumerator<DefinitionDocument>? enumerator = null;
        try
        {
            enumerator = definitions.GetEnumerator();
            while (enumerator.MoveNext())
            {
                var document = enumerator.Current;
                if (documents.Count == MaximumDefinitions)
                {
                    definitionLimit = true;
                    if (document is not null && SaturatingAdd(documents.Sum(_ => _.Utf8.Length), document.Utf8.Length) > MaximumAggregateDefinitionBytes)
                    {
                        aggregateLimit = true;
                    }
                    break;
                }

                if (document is null)
                {
                    documents.Add(new(null, DefinitionKind.Unknown, []));
                    continue;
                }

                var bytes = document.ToArray();
                if (SaturatingAdd(documents.Sum(_ => _.Utf8.Length), bytes.Length) > MaximumAggregateDefinitionBytes)
                {
                    aggregateLimit = true;
                    break;
                }
                documents.Add(new(document.LogicalId, document.Kind, bytes));
            }
        }
        catch (Exception error) when (IsNonFatal(error))
        {
            enumerationFailed = true;
            documents.Clear();
            definitionLimit = false;
            aggregateLimit = false;
        }
        finally
        {
            if (enumerator is not null)
            {
                try
                {
                    enumerator.Dispose();
                }
                catch (Exception error) when (IsNonFatal(error))
                {
                    documents.Clear();
                    definitionLimit = false;
                    aggregateLimit = false;
                    enumerationFailed = true;
                }
            }
        }

        return new(enumerationFailed ? [] : documents, enumerationFailed, definitionLimit || aggregateLimit, definitionLimit, aggregateLimit);
    }

    static List<AdmittedDefinition> Admit(
        SchemaResourceSet schemas,
        IReadOnlyList<CollectedDefinition> definitions,
        DefinitionDiagnosticCollection diagnostics)
    {
        var validIds = definitions.Where(_ => _.LogicalId is not null && IsSafeIdentifier(_.LogicalId)).Select(_ => _.LogicalId!).ToArray();
        foreach (var duplicate in validIds.GroupBy(_ => _, StringComparer.Ordinal).Where(_ => _.Count() > 1).Select(_ => _.Key))
        {
            diagnostics.Add(DefinitionDiagnosticCode.DuplicateDefinitionLogicalId, duplicate, "definitions/logical-id", duplicate);
        }

        var admitted = new List<AdmittedDefinition>(definitions.Count);
        foreach (var definition in definitions)
        {
            if (definition.LogicalId is null)
            {
                diagnostics.Add(DefinitionDiagnosticCode.InvalidDefinitionLogicalId, location: "definitions/logical-id");
                continue;
            }

            var logicalId = IsSafeIdentifier(definition.LogicalId) ? definition.LogicalId : string.Empty;
            if (logicalId.Length == 0)
            {
                diagnostics.Add(DefinitionDiagnosticCode.InvalidDefinitionLogicalId, location: "definitions/logical-id");
            }
            if (!DefinitionSchemaRoutes.All.TryGetValue(definition.Kind, out var route))
            {
                diagnostics.Add(DefinitionDiagnosticCode.UnsupportedDefinitionKind, logicalId, "definitions/kind");
                continue;
            }
            if (!CanonicalJson.TryParse(definition.Utf8, out var canonical, out var failure))
            {
                diagnostics.Add(DefinitionDiagnosticCode.CanonicalDefinitionRejected, logicalId, "definitions/bytes", canonicalCode: failure!.Code);
                continue;
            }

            var validation = schemas.Validate(route.SchemaId, definition.Utf8);
            if (validation.Status is not SchemaValidationStatus.Valid)
            {
                ProjectSchemaResult(validation, logicalId, canonical, definition.Kind, diagnostics);
                continue;
            }
            if (logicalId.Length == 0)
            {
                continue;
            }

            admitted.Add(new(
                new(logicalId, definition.Kind, route.SchemaId, Sha256Hash.Parse(route.ClosureIdentity), Sha256Hash.Calculate(canonical.Utf8)),
                canonical));
        }
        return admitted;
    }

    static void ProjectSchemaResult(
        SchemaValidationResult validation,
        string logicalId,
        CanonicalJsonValue canonical,
        DefinitionKind kind,
        DefinitionDiagnosticCollection diagnostics)
    {
        if (validation.Status is SchemaValidationStatus.DiagnosticLimitExceeded &&
            kind is DefinitionKind.Workflow &&
            !canonical.RootElement.TryGetProperty("documentKind", out _))
        {
            diagnostics.Add(
                DefinitionDiagnosticCode.DefinitionSchemaViolation,
                logicalId,
                "definitions/schema",
                schemaCode: SchemaDiagnosticCode.Required);
            return;
        }

        var projected = validation.Diagnostics.Where(_ => _.Code is not SchemaDiagnosticCode.DiagnosticLimitExceeded).ToArray();
        if (projected.Length == 0 && validation.Status is not SchemaValidationStatus.DiagnosticLimitExceeded)
        {
            diagnostics.Add(ToDefinitionCode(validation.Status), logicalId, "definitions/schema");
        }
        foreach (var diagnostic in projected)
        {
            var code = validation.Status is SchemaValidationStatus.DiagnosticLimitExceeded
                ? diagnostic.Status switch
                {
                    SchemaDiagnosticStatus.Violation => DefinitionDiagnosticCode.DefinitionSchemaViolation,
                    SchemaDiagnosticStatus.LimitExceeded => DefinitionDiagnosticCode.DefinitionEvaluationLimitExceeded,
                    _ => DefinitionDiagnosticCode.DefinitionSchemaRejected
                }
                : ToDefinitionCode(validation.Status);
            diagnostics.Add(code, logicalId, "definitions/schema", schemaCode: diagnostic.Code);
        }
        if (validation.Status is SchemaValidationStatus.DiagnosticLimitExceeded)
        {
            diagnostics.MarkOverflow();
        }
    }

    static DefinitionDiagnosticCode ToDefinitionCode(SchemaValidationStatus status) => status switch
    {
        SchemaValidationStatus.Invalid => DefinitionDiagnosticCode.DefinitionSchemaViolation,
        SchemaValidationStatus.EvaluationLimitExceeded => DefinitionDiagnosticCode.DefinitionEvaluationLimitExceeded,
        _ => DefinitionDiagnosticCode.DefinitionSchemaRejected
    };

    static Sha256Hash CalculateDefinitionSetIdentity(IEnumerable<DefinitionDescriptor> definitions)
    {
        var array = new JsonArray();
        foreach (var definition in definitions)
        {
            array.Add((JsonNode)new JsonObject
            {
                ["contentHash"] = definition.ContentHash.Value,
                ["kind"] = (int)definition.Kind,
                ["logicalId"] = definition.LogicalId,
                ["schemaClosureIdentity"] = definition.SchemaClosureIdentity.Value,
                ["schemaId"] = definition.SchemaId
            });
        }
        var value = CanonicalJson.Parse(Serialize(new JsonObject
        {
            ["algorithm"] = "factory-definition-set-v1",
            ["definitions"] = array,
            ["schemaSetIdentity"] = AcceptedDefinitionSchemas.Identity
        }));
        return Sha256Hash.Calculate(value.Utf8);
    }

    static DefinitionCompilationResult RejectEarly(
        DefinitionDiagnosticCode code,
        string location,
        string relatedId,
        Sha256Hash? schemaIdentity,
        string workflowId)
    {
        var diagnostics = new DefinitionDiagnosticCollection();
        diagnostics.Add(code, location: location, relatedId: relatedId);
        return Result(diagnostics, workflowId, schemaIdentity, null, [], null);
    }

    static DefinitionCompilationResult Result(
        DefinitionDiagnosticCollection diagnostics,
        string workflowId,
        Sha256Hash? schemaIdentity,
        Sha256Hash? definitionIdentity,
        IEnumerable<DefinitionDescriptor> definitions,
        CompiledWorkflow? workflow) => new(
            diagnostics.GetStatus(),
            workflowId,
            schemaIdentity,
            definitionIdentity,
            definitions,
            workflow,
            diagnostics.ToReadOnly());

    static bool IsSafeIdentifier(string? value)
    {
        if (string.IsNullOrEmpty(value) || value.Length > 256 || value[0] is not (>= 'a' and <= 'z'))
        {
            return false;
        }
        var previousHyphen = false;
        for (var index = 1; index < value.Length; index++)
        {
            var character = value[index];
            if (character is '-')
            {
                if (previousHyphen || index == value.Length - 1)
                {
                    return false;
                }
                previousHyphen = true;
            }
            else if (character is (>= 'a' and <= 'z') or (>= '0' and <= '9'))
            {
                previousHyphen = false;
            }
            else
            {
                return false;
            }
        }
        return true;
    }

    static int SaturatingAdd(int left, int right) => left > int.MaxValue - right ? int.MaxValue : left + right;

    static byte[] Serialize(JsonNode node)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using var writer = new Utf8JsonWriter(buffer);
        node.WriteTo(writer);
        writer.Flush();
        return buffer.WrittenSpan.ToArray();
    }

    static bool IsNonFatal(Exception error) => error is not OutOfMemoryException and not StackOverflowException and not AccessViolationException;

    sealed record CollectedDefinitions(
        IReadOnlyList<CollectedDefinition> Documents,
        bool EnumerationFailed,
        bool LimitExceeded,
        bool DefinitionLimitExceeded,
        bool AggregateBytesLimitExceeded);

    sealed record CollectedDefinition(string? LogicalId, DefinitionKind Kind, byte[] Utf8);
}

sealed record AdmittedDefinition(DefinitionDescriptor Descriptor, CanonicalJsonValue Value);

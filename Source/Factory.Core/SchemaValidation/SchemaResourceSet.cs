// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Frozen;
using System.Collections.ObjectModel;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Hashing;
using Json.Schema;

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Represents a closed immutable set of bounded Draft 2020-12 schema resources.
/// </summary>
public sealed class SchemaResourceSet
{
    readonly FrozenDictionary<string, LoadedSchemaResource> _resources;
    readonly FrozenDictionary<string, SchemaClosure> _closures;
    readonly FrozenDictionary<string, int> _evaluationRootNodes;
    readonly SchemaEvaluationGraph _evaluationGraph;

    internal SchemaResourceSet(
        IEnumerable<LoadedSchemaDocument> documents,
        IEnumerable<LoadedSchemaResource> resources,
        int anchorCount,
        int referenceCount,
        SchemaEvaluationGraph evaluationGraph)
    {
        var loadedDocuments = documents.OrderBy(_ => _.SchemaId, StringComparer.Ordinal).ToArray();
        var loadedResources = resources.OrderBy(_ => _.SchemaId, StringComparer.Ordinal).ToArray();
        _resources = loadedResources.ToFrozenDictionary(_ => _.SchemaId, StringComparer.Ordinal);
        Identity = SchemaIdentity.Calculate(loadedDocuments);
        Documents = new ReadOnlyCollection<SchemaDocumentDescriptor>([.. loadedDocuments.Select(ToDocumentDescriptor)]);
        Resources = new ReadOnlyCollection<SchemaResourceDescriptor>([.. loadedResources.Select(ToResourceDescriptor)]);
        AnchorCount = anchorCount;
        ReferenceCount = referenceCount;
        _evaluationGraph = evaluationGraph;
        var closureGraph = loadedDocuments.SelectMany(_ => _.GraphEdges)
            .GroupBy(_ => _.Source, StringComparer.Ordinal)
            .ToDictionary(
                _ => _.Key,
                _ => _.Select(edge => edge.Target).Distinct(StringComparer.Ordinal).ToArray(),
                StringComparer.Ordinal);
        var resourceOwners = loadedDocuments
            .SelectMany(document => document.SchemaPointerResources.Select(entry => new
            {
                Node = SchemaResourceSyntax.NodeKey(document, entry.Key),
                Resource = entry.Value
            }))
            .ToDictionary(_ => _.Node, _ => _.Resource, StringComparer.Ordinal);
        _closures = loadedResources.ToFrozenDictionary(
            _ => _.SchemaId,
            _ => BuildClosure(_, closureGraph, resourceOwners),
            StringComparer.Ordinal);
        _evaluationRootNodes = loadedResources.ToFrozenDictionary(
            _ => _.SchemaId,
            evaluationGraph.GetNodeIndex,
            StringComparer.Ordinal);
    }

    /// <summary>
    /// Gets the canonical identity of the sorted top-level logical-ID and canonical-content-hash manifest.
    /// </summary>
    public Sha256Hash Identity { get; }

    /// <summary>
    /// Gets the ordered top-level document descriptors.
    /// </summary>
    public IReadOnlyList<SchemaDocumentDescriptor> Documents { get; }

    /// <summary>
    /// Gets the ordered top-level and embedded resource descriptors.
    /// </summary>
    public IReadOnlyList<SchemaResourceDescriptor> Resources { get; }

    /// <summary>
    /// Gets the total number of anchors in the resource set.
    /// </summary>
    public int AnchorCount { get; }

    /// <summary>
    /// Gets the total number of reference edges in the resource set.
    /// </summary>
    public int ReferenceCount { get; }

    /// <summary>
    /// Loads a closed immutable schema resource set from caller-supplied bytes.
    /// </summary>
    /// <param name="documents">The schema documents with explicit logical identifiers.</param>
    /// <returns>A stable loading result.</returns>
    public static SchemaLoadResult Load(IEnumerable<SchemaDocument> documents) => SchemaResourceLoader.Load(documents);

    /// <summary>
    /// Selects the immutable transitive closure for a top-level or embedded schema resource.
    /// </summary>
    /// <param name="schemaId">The exact admitted resource identifier.</param>
    /// <returns>A stable closure-selection result.</returns>
    public SchemaClosureResult GetClosure(string? schemaId)
    {
        if (!SchemaResourceScanner.TryCreateAbsoluteSchemaId(schemaId, out _))
        {
            var invalid = new SchemaDiagnosticCollection();
            invalid.Add(SchemaDiagnosticCode.InvalidSchemaId);
            return new(SchemaClosureStatus.Rejected, string.Empty, Identity, null, invalid.ToReadOnly());
        }

        var validSchemaId = schemaId!;
        if (!_closures.TryGetValue(validSchemaId, out var closure))
        {
            var missing = new SchemaDiagnosticCollection();
            missing.Add(SchemaDiagnosticCode.SchemaNotFound, schemaId: validSchemaId);
            return new(SchemaClosureStatus.NotFound, validSchemaId, Identity, null, missing.ToReadOnly(validSchemaId));
        }

        return new(SchemaClosureStatus.Resolved, validSchemaId, Identity, closure, []);
    }

    /// <summary>
    /// Validates one bounded caller-supplied instance against a top-level or embedded schema resource.
    /// </summary>
    /// <param name="schemaId">The exact admitted resource identifier.</param>
    /// <param name="instanceUtf8">The instance as strict UTF-8 JSON.</param>
    /// <returns>A stable bounded validation result.</returns>
    public SchemaValidationResult Validate(string? schemaId, ReadOnlySpan<byte> instanceUtf8)
    {
        var closureResult = GetClosure(schemaId);
        if (closureResult.Status is not SchemaClosureStatus.Resolved)
        {
            return new(
                SchemaValidationStatus.Rejected,
                closureResult.SchemaId,
                Identity,
                null,
                closureResult.Diagnostics);
        }

        var selectedSchemaId = closureResult.SchemaId;
        var resource = _resources[selectedSchemaId];
        var closure = closureResult.Closure!;
        if (!CanonicalJson.TryParse(instanceUtf8, out var instance, out var failure))
        {
            var rejected = new SchemaDiagnosticCollection();
            rejected.Add(SchemaCanonicalFailureProjection.ToDiagnosticCode(failure!.Code), schemaId: selectedSchemaId);
            return new(SchemaValidationStatus.Rejected, selectedSchemaId, Identity, closure, rejected.ToReadOnly(selectedSchemaId));
        }

        var work = SchemaValidationWork.Measure(instance.RootElement, _evaluationGraph, _evaluationRootNodes[selectedSchemaId]);
        if (work.ExceedsValidationLimit)
        {
            var limited = new SchemaDiagnosticCollection();
            limited.Add(
                work.InstanceNodes > SchemaValidationLimits.MaximumInstanceNodes
                    ? SchemaDiagnosticCode.InstanceNodeLimitExceeded
                    : SchemaDiagnosticCode.EvaluationWorkLimitExceeded,
                schemaId: selectedSchemaId);
            return new(
                SchemaValidationStatus.EvaluationLimitExceeded,
                selectedSchemaId,
                Identity,
                closure,
                limited.ToReadOnly(selectedSchemaId));
        }

        var producingDiagnostics = false;
        try
        {
            if (resource.Schema!.BoolValue is false)
            {
                var falseSchema = new SchemaDiagnosticCollection();
                falseSchema.Add(SchemaDiagnosticCode.FalseSchema, SchemaDiagnosticStatus.Violation, selectedSchemaId);
                return new(SchemaValidationStatus.Invalid, selectedSchemaId, Identity, closure, falseSchema.ToReadOnly(selectedSchemaId));
            }

            var flagOptions = SafeEvaluationOptions.ForValidation(OutputFormat.Flag);
            var flag = resource.Schema.Evaluate(instance.RootElement, flagOptions);
            if (flag.IsValid)
            {
                return new(
                    SchemaValidationStatus.Valid,
                    selectedSchemaId,
                    Identity,
                    closure,
                    []);
            }
            if (work.ExceedsDiagnosticLimit)
            {
                var limited = new SchemaDiagnosticCollection();
                limited.Add(SchemaDiagnosticCode.DiagnosticLimitExceeded, schemaId: selectedSchemaId);
                return new(
                    SchemaValidationStatus.DiagnosticLimitExceeded,
                    selectedSchemaId,
                    Identity,
                    closure,
                    limited.ToReadOnly(selectedSchemaId));
            }

            producingDiagnostics = true;
            var options = SafeEvaluationOptions.ForDiagnostics();
            var results = resource.Schema.Evaluate(instance.RootElement, options);
            var diagnostics = SchemaResultProjection.Project(results, resource, _resources.Values, instance.RootElement);
            var status = diagnostics.LimitExceeded
                ? SchemaValidationStatus.DiagnosticLimitExceeded
                : SchemaValidationStatus.Invalid;
            return new(status, selectedSchemaId, Identity, closure, diagnostics.Diagnostics);
        }
        catch (SchemaEvaluationBudgetExceeded)
        {
            var limited = new SchemaDiagnosticCollection();
            limited.Add(
                producingDiagnostics
                    ? SchemaDiagnosticCode.DiagnosticLimitExceeded
                    : SchemaDiagnosticCode.EvaluationWorkLimitExceeded,
                schemaId: selectedSchemaId);
            return new(
                producingDiagnostics
                    ? SchemaValidationStatus.DiagnosticLimitExceeded
                    : SchemaValidationStatus.EvaluationLimitExceeded,
                selectedSchemaId,
                Identity,
                closure,
                limited.ToReadOnly(selectedSchemaId));
        }
        catch (RefResolutionException)
        {
            var rejected = new SchemaDiagnosticCollection();
            rejected.Add(SchemaDiagnosticCode.UnresolvedReference, schemaId: selectedSchemaId);
            return new(SchemaValidationStatus.Rejected, selectedSchemaId, Identity, closure, rejected.ToReadOnly(selectedSchemaId));
        }
        catch (JsonSchemaException)
        {
            var rejected = new SchemaDiagnosticCollection();
            rejected.Add(SchemaDiagnosticCode.SchemaBuildFailed, schemaId: selectedSchemaId);
            return new(SchemaValidationStatus.Rejected, selectedSchemaId, Identity, closure, rejected.ToReadOnly(selectedSchemaId));
        }
        catch (Exception error) when (SchemaExceptionBoundary.IsNonFatal(error))
        {
            var rejected = new SchemaDiagnosticCollection();
            rejected.Add(SchemaDiagnosticCode.ValidationFailed, schemaId: selectedSchemaId);
            return new(SchemaValidationStatus.Rejected, selectedSchemaId, Identity, closure, rejected.ToReadOnly(selectedSchemaId));
        }
    }

    static SchemaDocumentDescriptor ToDocumentDescriptor(LoadedSchemaDocument document) =>
        new(document.SchemaId, document.ContentHash, document.Resources.Sum(_ => _.References.Count));

    static SchemaResourceDescriptor ToResourceDescriptor(LoadedSchemaResource resource) =>
        new(resource.SchemaId, resource.Document.SchemaId, resource.Document.ContentHash, resource.References.Count);

    static SchemaClosure BuildClosure(
        LoadedSchemaResource root,
        IReadOnlyDictionary<string, string[]> outgoing,
        Dictionary<string, LoadedSchemaResource> resourceOwners)
    {
        var reachableNodes = new HashSet<string>(StringComparer.Ordinal);
        var reachableResources = new HashSet<LoadedSchemaResource>();
        var pendingNodes = new Queue<string>();
        var pendingResources = new Queue<LoadedSchemaResource>();
        AddResource(root);
        while (pendingNodes.Count > 0 || pendingResources.Count > 0)
        {
            while (pendingNodes.Count > 0)
            {
                var source = pendingNodes.Dequeue();
                foreach (var target in outgoing.GetValueOrDefault(source) ?? [])
                {
                    if (!reachableNodes.Add(target)) continue;

                    pendingNodes.Enqueue(target);
                    if (resourceOwners.TryGetValue(target, out var resource))
                    {
                        AddResource(resource);
                    }
                }
            }

            while (pendingResources.Count > 0)
            {
                var resource = pendingResources.Dequeue();
                foreach (var reference in resource.References)
                {
                    AddResource(reference.TargetResource);
                }
            }
        }

        var orderedResources = reachableResources.OrderBy(_ => _.SchemaId, StringComparer.Ordinal).ToArray();
        var orderedDocuments = orderedResources.Select(_ => _.Document).Distinct().OrderBy(_ => _.SchemaId, StringComparer.Ordinal).ToArray();
        var memberDescriptors = new ReadOnlyCollection<SchemaClosureMember>([.. orderedDocuments.Select(document =>
            new SchemaClosureMember(
                document.SchemaId,
                document.ContentHash,
                orderedResources.Where(resource => ReferenceEquals(resource.Document, document)).Sum(resource => resource.References.Count)))]);
        return new(
            root.SchemaId,
            SchemaIdentity.Calculate(orderedDocuments, root.SchemaId),
            memberDescriptors,
            orderedResources.Length,
            orderedResources.Sum(_ => _.Anchors.Count),
            orderedResources.Sum(_ => _.References.Count));

        void AddResource(LoadedSchemaResource resource)
        {
            if (!reachableResources.Add(resource)) return;

            pendingResources.Enqueue(resource);
            var rootNode = SchemaResourceSyntax.NodeKey(resource.Document, resource.RootPointer);
            if (reachableNodes.Add(rootNode)) pendingNodes.Enqueue(rootNode);
        }
    }
}

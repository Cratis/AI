// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Canonicalization;
using Json.Schema;

namespace Cratis.Factory.SchemaValidation;

static class SchemaResourceLoader
{
    const string Draft202012 = "https://json-schema.org/draft/2020-12/schema";

    public static SchemaLoadResult Load(IEnumerable<SchemaDocument> documents)
    {
        var diagnostics = new SchemaDiagnosticCollection();
        var supplied = TakeBounded(documents, diagnostics);
        if (supplied.Count == 0)
        {
            if (!diagnostics.HasDiagnostics)
            {
                diagnostics.Add(SchemaDiagnosticCode.NoSchemaDocuments);
            }

            return Rejected(diagnostics);
        }

        if (diagnostics.HasDiagnostics) return Rejected(diagnostics);

        var loadedDocuments = new List<LoadedSchemaDocument>();
        var resources = new Dictionary<string, LoadedSchemaResource>(StringComparer.Ordinal);
        var exactIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var suppliedDocument in supplied.OrderBy(_ => _.LogicalId, StringComparer.Ordinal))
        {
            LoadDocument(suppliedDocument, exactIds, resources, loadedDocuments, diagnostics);
        }

        if (diagnostics.HasDiagnostics) return Rejected(diagnostics);

        if (resources.Count > SchemaValidationLimits.MaximumResources)
        {
            diagnostics.Add(SchemaDiagnosticCode.ResourceLimitExceeded);
        }

        var pendingReferences = new List<PendingSchemaReference>();
        var scanner = new SchemaResourceScanner(resources, pendingReferences, diagnostics);
        foreach (var document in loadedDocuments.OrderBy(_ => _.SchemaId, StringComparer.Ordinal))
        {
            scanner.Scan(document, document.Resources[0]);
        }

        scanner.ResolveReferencesAndCheckCycles();
        if (diagnostics.HasDiagnostics) return Rejected(diagnostics);

        if (!SchemaEvaluationGraph.TryCreate(loadedDocuments, out var evaluationGraph))
        {
            diagnostics.Add(SchemaDiagnosticCode.SchemaBuildFailed);
            return Rejected(diagnostics);
        }

        if (!TryBuild(loadedDocuments, diagnostics)) return Rejected(diagnostics);

        var resourceSet = new SchemaResourceSet(
            loadedDocuments,
            resources.Values,
            scanner.AnchorCount,
            scanner.ReferenceCount,
            evaluationGraph!);
        return new(SchemaLoadStatus.Loaded, resourceSet, []);
    }

    static List<SchemaDocument> TakeBounded(IEnumerable<SchemaDocument> documents, SchemaDiagnosticCollection diagnostics)
    {
        var supplied = new List<SchemaDocument>();
        if (documents is null) return supplied;

        long aggregateBytes = 0;
        var observedCount = 0;
        try
        {
            foreach (var document in documents)
            {
                if (observedCount == SchemaValidationLimits.MaximumDocuments)
                {
                    diagnostics.Add(SchemaDiagnosticCode.DocumentLimitExceeded);
                    break;
                }

                observedCount++;
                if (document is null)
                {
                    diagnostics.Add(SchemaDiagnosticCode.InvalidSchemaId);
                    continue;
                }

                var nextAggregateBytes = aggregateBytes + document.Utf8.Length;
                if (nextAggregateBytes > SchemaValidationLimits.MaximumAggregateSchemaBytes)
                {
                    diagnostics.Add(SchemaDiagnosticCode.AggregateSchemaBytesLimitExceeded);
                    break;
                }

                aggregateBytes = nextAggregateBytes;
                supplied.Add(document);
            }
        }
        catch (Exception error) when (SchemaExceptionBoundary.IsNonFatal(error))
        {
            diagnostics.Add(SchemaDiagnosticCode.SchemaDocumentEnumerationFailed);
        }

        return supplied;
    }

    static void LoadDocument(
        SchemaDocument supplied,
        HashSet<string> exactIds,
        Dictionary<string, LoadedSchemaResource> resources,
        List<LoadedSchemaDocument> loadedDocuments,
        SchemaDiagnosticCollection diagnostics)
    {
        var logicalIdIsValid = SchemaResourceScanner.TryCreateAbsoluteSchemaId(supplied.LogicalId, out var resourceUri);
        var diagnosticSchemaId = logicalIdIsValid ? supplied.LogicalId : null;
        var accepted = logicalIdIsValid;
        if (!logicalIdIsValid)
        {
            diagnostics.Add(SchemaDiagnosticCode.InvalidSchemaId);
        }
        else if (!exactIds.Add(supplied.LogicalId))
        {
            diagnostics.Add(SchemaDiagnosticCode.DuplicateSchemaId, schemaId: supplied.LogicalId);
            accepted = false;
        }

        if (!CanonicalJson.TryParse(supplied.Utf8, out var canonical, out var failure))
        {
            diagnostics.Add(SchemaCanonicalFailureProjection.ToDiagnosticCode(failure!.Code), schemaId: diagnosticSchemaId);
            return;
        }

        if (canonical.RootElement.ValueKind is not (System.Text.Json.JsonValueKind.Object or System.Text.Json.JsonValueKind.True or System.Text.Json.JsonValueKind.False))
        {
            diagnostics.Add(SchemaDiagnosticCode.MalformedSchema, schemaId: diagnosticSchemaId);
            return;
        }

        if (canonical.RootElement.ValueKind is System.Text.Json.JsonValueKind.Object)
        {
            var rootMetadataIsValid = ValidateRootMetadata(canonical.RootElement, supplied.LogicalId, diagnosticSchemaId, diagnostics);
            accepted = accepted && rootMetadataIsValid;
        }

        if (!accepted) return;

        var resourceKey = resourceUri!.AbsoluteUri;
        if (resources.ContainsKey(resourceKey))
        {
            diagnostics.Add(SchemaDiagnosticCode.DuplicateSchemaId, schemaId: supplied.LogicalId);
            return;
        }

        if (resources.Count >= SchemaValidationLimits.MaximumResources)
        {
            diagnostics.Add(SchemaDiagnosticCode.ResourceLimitExceeded, schemaId: supplied.LogicalId);
            return;
        }

        var loaded = new LoadedSchemaDocument(supplied.LogicalId, resourceUri, canonical);
        var rootResource = new LoadedSchemaResource(supplied.LogicalId, resourceUri, loaded, string.Empty, canonical.RootElement);
        loaded.Resources.Add(rootResource);
        resources.Add(resourceKey, rootResource);
        loadedDocuments.Add(loaded);
    }

    static bool ValidateRootMetadata(
        System.Text.Json.JsonElement schema,
        string logicalId,
        string? diagnosticSchemaId,
        SchemaDiagnosticCollection diagnostics)
    {
        var accepted = true;
        if (!schema.TryGetProperty("$id", out var id))
        {
            diagnostics.Add(SchemaDiagnosticCode.MissingSchemaId, schemaId: diagnosticSchemaId, keywordLocation: "#/$id");
            accepted = false;
        }
        else if (id.ValueKind is not System.Text.Json.JsonValueKind.String)
        {
            diagnostics.Add(SchemaDiagnosticCode.InvalidSchemaId, schemaId: diagnosticSchemaId, keywordLocation: "#/$id");
            accepted = false;
        }
        else if (!string.Equals(id.GetString(), logicalId, StringComparison.Ordinal))
        {
            diagnostics.Add(SchemaDiagnosticCode.SchemaIdMismatch, schemaId: diagnosticSchemaId, keywordLocation: "#/$id");
            accepted = false;
        }

        if (!schema.TryGetProperty("$schema", out var dialect))
        {
            diagnostics.Add(SchemaDiagnosticCode.MissingDialect, schemaId: diagnosticSchemaId, keywordLocation: "#/$schema");
            return false;
        }
        if (dialect.ValueKind is not System.Text.Json.JsonValueKind.String ||
            !string.Equals(dialect.GetString(), Draft202012, StringComparison.Ordinal))
        {
            diagnostics.Add(SchemaDiagnosticCode.UnsupportedDialect, schemaId: diagnosticSchemaId, keywordLocation: "#/$schema");
            return false;
        }

        return accepted;
    }

    static bool TryBuild(
        IEnumerable<LoadedSchemaDocument> documents,
        SchemaDiagnosticCollection diagnostics)
    {
        var orderedDocuments = documents.OrderBy(_ => _.SchemaId, StringComparer.Ordinal).ToArray();
        var orderedResources = orderedDocuments.SelectMany(_ => _.Resources)
            .OrderBy(_ => _.SchemaId, StringComparer.Ordinal)
            .ToArray();
        if (!SchemaSanitizer.TryPrepare(orderedResources, out var views))
        {
            diagnostics.Add(SchemaDiagnosticCode.SchemaBuildFailed);
            return false;
        }

        try
        {
            foreach (var resource in orderedResources)
            {
                var registry = new SchemaRegistry
                {
                    Fetch = null!
                };
                var localDocuments = new Dictionary<LoadedSchemaResource, LocalSchemaBaseDocument>();
                foreach (var otherResource in orderedResources.Where(_ => !ReferenceEquals(_, resource)))
                {
                    var localDocument = new LocalSchemaBaseDocument(views![otherResource]);
                    registry.Register(otherResource.ResourceUri, localDocument);
                    localDocuments.Add(otherResource, localDocument);
                }

                var options = new BuildOptions
                {
                    Dialect = SafeDraft202012Dialect.Instance,
                    SchemaRegistry = registry
                };
                var view = views![resource];
                var schema = JsonSchema.Build(view.Root, options, resource.ResourceUri);
                if (!SchemaBuildFinalizer.IsExpectedRoot(schema, view))
                {
                    diagnostics.Add(SchemaDiagnosticCode.SchemaBuildFailed, schemaId: resource.Document.SchemaId);
                    return false;
                }

                if (!SchemaBuildFinalizer.TryFinalize(schema, view, localDocuments, out var failure))
                {
                    diagnostics.Add(failure, schemaId: resource.Document.SchemaId);
                    return false;
                }

                resource.PackageView = view;
                resource.Schema = schema;
                if (resource.RootPointer.Length == 0)
                {
                    resource.Document.Schema = schema;
                }
            }

            return true;
        }
        catch (RefResolutionException)
        {
            diagnostics.Add(SchemaDiagnosticCode.UnresolvedReference);
        }
        catch (Exception error) when (SchemaExceptionBoundary.IsNonFatal(error))
        {
            diagnostics.Add(SchemaDiagnosticCode.SchemaBuildFailed);
        }

        return false;
    }

    static SchemaLoadResult Rejected(SchemaDiagnosticCollection diagnostics) =>
        new(SchemaLoadStatus.Rejected, null, diagnostics.ToReadOnly());
}

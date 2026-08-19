// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.Factory.SchemaValidation;

sealed class SchemaResourceScanner(
    IDictionary<string, LoadedSchemaResource> resources,
    IList<PendingSchemaReference> pendingReferences,
    SchemaDiagnosticCollection diagnostics)
{
    const string Draft202012 = "https://json-schema.org/draft/2020-12/schema";
    static readonly HashSet<string> _supportedVocabularies = new(StringComparer.Ordinal)
    {
        "https://json-schema.org/draft/2020-12/vocab/applicator",
        "https://json-schema.org/draft/2020-12/vocab/content",
        "https://json-schema.org/draft/2020-12/vocab/core",
        "https://json-schema.org/draft/2020-12/vocab/format-annotation",
        "https://json-schema.org/draft/2020-12/vocab/meta-data",
        "https://json-schema.org/draft/2020-12/vocab/unevaluated",
        "https://json-schema.org/draft/2020-12/vocab/validation"
    };
    static readonly HashSet<string> _unsupportedKeywords = new(StringComparer.Ordinal)
    {
        "$comment", "$dynamicAnchor", "$dynamicRef", "contentEncoding", "contentMediaType", "contentSchema", "default",
        "dependentRequired", "dependentSchemas", "deprecated", "examples", "exclusiveMaximum", "exclusiveMinimum",
        "maxContains", "maxProperties", "minContains", "minProperties", "multipleOf", "patternProperties",
        "prefixItems", "propertyNames", "readOnly", "unevaluatedItems", "writeOnly"
    };
    static readonly HashSet<string> _singleSchemaKeywords = new(StringComparer.Ordinal)
    {
        "additionalProperties", "contains", "else", "if", "items", "not", "then", "unevaluatedProperties"
    };
    static readonly HashSet<string> _schemaArrayKeywords = new(StringComparer.Ordinal) { "allOf", "anyOf", "oneOf" };
    static readonly HashSet<string> _schemaMapKeywords = new(StringComparer.Ordinal) { "$defs", "properties" };
    bool _hardLimitExceeded;
    public int AnchorCount { get; private set; }

    public int ReferenceCount { get; private set; }

    public int SchemaNodeCount { get; private set; }

    public static bool TryCreateAbsoluteSchemaId(string? value, out Uri? uri) =>
        SchemaResourceSyntax.TryCreateAbsoluteSchemaId(value, out uri);

    public void Scan(LoadedSchemaDocument document, LoadedSchemaResource rootResource) =>
        ScanSchema(document.Value.RootElement, document, rootResource, string.Empty);

    public void ResolveReferencesAndCheckCycles()
    {
        if (_hardLimitExceeded) return;

        foreach (var pending in pendingReferences.OrderBy(_ => _.SourceResource.SchemaId, StringComparer.Ordinal)
                     .ThenBy(_ => _.KeywordPointer, StringComparer.Ordinal))
        {
            if (!TryResolveReferenceTarget(pending, out var targetResource, out var targetPointer))
            {
                diagnostics.Add(
                    SchemaDiagnosticCode.UnresolvedReference,
                    schemaId: pending.SourceResource.Document.SchemaId,
                    keywordLocation: SafeSchemaLocation.FromSchemaPointer(
                        pending.KeywordPointer,
                        pending.SourceResource.Document.Value.RootElement));
                continue;
            }

            var edge = new SchemaReferenceEdge(
                pending.SourceResource,
                targetResource!,
                pending.SourcePointer,
                targetPointer!,
                pending.KeywordPointer);
            pending.SourceResource.References.Add(edge);
            pending.SourceResource.Document.GraphEdges.Add(new(
                SchemaResourceSyntax.NodeKey(pending.SourceResource.Document, pending.SourcePointer),
                SchemaResourceSyntax.NodeKey(targetResource!.Document, targetPointer!),
                SchemaInstanceSelector.SameInstance,
                true));
        }

        if (diagnostics.HasDiagnostics) return;

        var edges = resources.Values
            .Select(_ => _.Document)
            .Distinct()
            .SelectMany(_ => _.GraphEdges)
            .Where(_ => !_.Selector.ConsumesInstance)
            .Distinct()
            .OrderBy(_ => _.Source, StringComparer.Ordinal)
            .ThenBy(_ => _.Target, StringComparer.Ordinal)
            .ToArray();
        var adjacency = edges.GroupBy(_ => _.Source, StringComparer.Ordinal)
            .ToDictionary(_ => _.Key, _ => _.Select(edge => edge.Target).Distinct().Order(StringComparer.Ordinal).ToArray(), StringComparer.Ordinal);
        var states = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var node in edges.SelectMany(_ => new[] { _.Source, _.Target }).Distinct().Order(StringComparer.Ordinal))
        {
            if (SchemaResourceSyntax.ContainsCycle(node, adjacency, states))
            {
                var separator = node.IndexOf('\n', StringComparison.Ordinal);
                var documentId = separator < 0 ? null : node[..separator];
                var pointer = separator < 0 ? string.Empty : node[(separator + 1)..];
                var document = resources.Values.FirstOrDefault(_ => string.Equals(_.Document.SchemaId, documentId, StringComparison.Ordinal))?.Document;
                diagnostics.Add(
                    SchemaDiagnosticCode.UnproductiveReferenceCycle,
                    schemaId: documentId,
                    keywordLocation: document is null
                        ? "#"
                        : SafeSchemaLocation.FromSchemaPointer(pointer, document.Value.RootElement));
                return;
            }
        }

        CheckReferenceDepth(edges);
    }

    static SchemaInstanceSelector CreateSelector(string keyword, JsonElement parentSchema) => keyword switch
    {
        "contains" or "items" => SchemaInstanceSelector.EachArrayItem,
        "unevaluatedProperties" => SchemaInstanceSelector.EveryObjectValue,
        "additionalProperties" => new(
            SchemaInstanceSelectorKind.AdditionalObjectMember,
            ExcludedPropertyNames: GetDeclaredPropertyNames(parentSchema)),
        _ => SchemaInstanceSelector.SameInstance
    };

    static string[] GetDeclaredPropertyNames(JsonElement schema)
    {
        if (!schema.TryGetProperty("properties", out var properties) || properties.ValueKind is not JsonValueKind.Object)
        {
            return [];
        }

        return [.. properties.EnumerateObject().Select(_ => _.Name).Order(StringComparer.Ordinal)];
    }

    void ScanSchema(JsonElement schema, LoadedSchemaDocument document, LoadedSchemaResource resource, string pointer)
    {
        if (_hardLimitExceeded) return;

        SchemaNodeCount++;
        if (SchemaNodeCount > SchemaValidationLimits.MaximumSchemaNodes)
        {
            diagnostics.Add(
                SchemaDiagnosticCode.SchemaNodeLimitExceeded,
                schemaId: document.SchemaId,
                keywordLocation: SafeSchemaLocation.FromSchemaPointer(pointer, document.Value.RootElement));
            _hardLimitExceeded = true;

            return;
        }

        document.SchemaPointers.Add(pointer);
        document.SchemaPointerResources[pointer] = resource;
        document.EvaluationCostProfiles[SchemaResourceSyntax.NodeKey(document, pointer)] =
            SchemaValidationCostModel.CreateProfile(schema);
        if (schema.ValueKind is JsonValueKind.True or JsonValueKind.False) return;
        if (schema.ValueKind is not JsonValueKind.Object)
        {
            diagnostics.Add(
                SchemaDiagnosticCode.MalformedSchema,
                schemaId: document.SchemaId,
                keywordLocation: SafeSchemaLocation.FromSchemaPointer(pointer, document.Value.RootElement));
            return;
        }

        var activeResource = ResolveEmbeddedResource(schema, document, resource, pointer);
        if (_hardLimitExceeded) return;

        document.SchemaPointerResources[pointer] = activeResource;
        ValidateDialect(schema, document, pointer);
        ValidateVocabulary(schema, document, pointer);
        RegisterAnchor(schema, document, activeResource, pointer);
        RegisterReference(schema, document, activeResource, pointer);

        foreach (var property in schema.EnumerateObject())
        {
            if (_hardLimitExceeded) break;

            var propertyPointer = SchemaResourceSyntax.CombinePointer(pointer, property.Name);
            if (_unsupportedKeywords.Contains(property.Name))
            {
                diagnostics.Add(
                    SchemaDiagnosticCode.UnsupportedKeyword,
                    schemaId: document.SchemaId,
                    keywordLocation: SafeSchemaLocation.FromSchemaPointer(propertyPointer, document.Value.RootElement));
                continue;
            }

            if (property.Name == "pattern")
            {
                var rejection = property.Value.ValueKind == JsonValueKind.String
                    ? SafePatternKeyword.TryCreate(property.Value.GetString()!, out _)
                    : SchemaDiagnosticCode.InvalidPattern;
                if (rejection is not null)
                {
                    diagnostics.Add(
                        rejection.Value,
                        schemaId: document.SchemaId,
                        keywordLocation: SafeSchemaLocation.FromSchemaPointer(propertyPointer, document.Value.RootElement));
                }
            }

            if (_singleSchemaKeywords.Contains(property.Name))
            {
                ScanSingleSchema(property, propertyPointer, document, activeResource, pointer, schema);
            }
            else if (_schemaArrayKeywords.Contains(property.Name))
            {
                ScanSchemaArray(property, propertyPointer, document, activeResource, pointer);
            }
            else if (_schemaMapKeywords.Contains(property.Name))
            {
                ScanSchemaMap(property, propertyPointer, document, activeResource, pointer);
            }
        }
    }

    LoadedSchemaResource ResolveEmbeddedResource(
        JsonElement schema,
        LoadedSchemaDocument document,
        LoadedSchemaResource currentResource,
        string pointer)
    {
        if (pointer == currentResource.RootPointer || !schema.TryGetProperty("$id", out var idElement)) return currentResource;
        var location = SafeSchemaLocation.FromSchemaPointer(SchemaResourceSyntax.CombinePointer(pointer, "$id"), document.Value.RootElement);
        if (idElement.ValueKind is not JsonValueKind.String ||
            !SchemaResourceSyntax.TryResolveSchemaId(currentResource.ResourceUri, idElement.GetString()!, out var resolved))
        {
            diagnostics.Add(SchemaDiagnosticCode.InvalidSchemaId, schemaId: document.SchemaId, keywordLocation: location);
            return currentResource;
        }

        var key = SchemaResourceSyntax.ResourceKey(resolved!);
        if (resources.ContainsKey(key))
        {
            diagnostics.Add(SchemaDiagnosticCode.DuplicateResourceId, schemaId: document.SchemaId, keywordLocation: location);
            return currentResource;
        }

        if (resources.Count >= SchemaValidationLimits.MaximumResources)
        {
            diagnostics.Add(SchemaDiagnosticCode.ResourceLimitExceeded, schemaId: document.SchemaId, keywordLocation: location);
            _hardLimitExceeded = true;
            return currentResource;
        }

        var embedded = new LoadedSchemaResource(resolved!.AbsoluteUri, resolved, document, pointer, schema);
        resources.Add(key, embedded);
        document.Resources.Add(embedded);
        return embedded;
    }

    void ValidateDialect(JsonElement schema, LoadedSchemaDocument document, string pointer)
    {
        if (!schema.TryGetProperty("$schema", out var dialect)) return;
        var location = SafeSchemaLocation.FromSchemaPointer(SchemaResourceSyntax.CombinePointer(pointer, "$schema"), document.Value.RootElement);
        if (dialect.ValueKind is not JsonValueKind.String || !string.Equals(dialect.GetString(), Draft202012, StringComparison.Ordinal))
        {
            diagnostics.Add(SchemaDiagnosticCode.UnsupportedDialect, schemaId: document.SchemaId, keywordLocation: location);
        }
    }

    void ValidateVocabulary(JsonElement schema, LoadedSchemaDocument document, string pointer)
    {
        if (!schema.TryGetProperty("$vocabulary", out var vocabulary)) return;
        var location = SchemaResourceSyntax.CombinePointer(pointer, "$vocabulary");
        if (vocabulary.ValueKind is not JsonValueKind.Object)
        {
            diagnostics.Add(
                SchemaDiagnosticCode.MalformedVocabulary,
                schemaId: document.SchemaId,
                keywordLocation: SafeSchemaLocation.FromSchemaPointer(location, document.Value.RootElement));
            return;
        }

        foreach (var entry in vocabulary.EnumerateObject())
        {
            var entryLocation = SafeSchemaLocation.FromSchemaPointer(SchemaResourceSyntax.CombinePointer(location, entry.Name), document.Value.RootElement);
            if (entry.Value.ValueKind is not (JsonValueKind.True or JsonValueKind.False))
            {
                diagnostics.Add(SchemaDiagnosticCode.MalformedVocabulary, schemaId: document.SchemaId, keywordLocation: entryLocation);
                continue;
            }

            if (entry.Value.GetBoolean() && !_supportedVocabularies.Contains(entry.Name))
            {
                diagnostics.Add(SchemaDiagnosticCode.UnsupportedVocabulary, schemaId: document.SchemaId, keywordLocation: entryLocation);
            }
        }
    }

    void RegisterAnchor(JsonElement schema, LoadedSchemaDocument document, LoadedSchemaResource resource, string pointer)
    {
        if (!schema.TryGetProperty("$anchor", out var anchor)) return;
        var location = SafeSchemaLocation.FromSchemaPointer(SchemaResourceSyntax.CombinePointer(pointer, "$anchor"), document.Value.RootElement);
        if (anchor.ValueKind is not JsonValueKind.String || !SchemaResourceSyntax.IsValidAnchor(anchor.GetString()!))
        {
            diagnostics.Add(SchemaDiagnosticCode.InvalidAnchor, schemaId: document.SchemaId, keywordLocation: location);
            return;
        }

        var value = anchor.GetString()!;
        if (!resource.Anchors.TryAdd(value, pointer))
        {
            diagnostics.Add(SchemaDiagnosticCode.DuplicateAnchor, schemaId: document.SchemaId, keywordLocation: location);
            return;
        }

        AnchorCount++;
        if (AnchorCount > SchemaValidationLimits.MaximumAnchors)
        {
            diagnostics.Add(SchemaDiagnosticCode.AnchorLimitExceeded, schemaId: document.SchemaId, keywordLocation: location);
            _hardLimitExceeded = true;
        }
    }

    void RegisterReference(JsonElement schema, LoadedSchemaDocument document, LoadedSchemaResource resource, string pointer)
    {
        if (!schema.TryGetProperty("$ref", out var reference)) return;
        var keywordPointer = SchemaResourceSyntax.CombinePointer(pointer, "$ref");
        var location = SafeSchemaLocation.FromSchemaPointer(keywordPointer, document.Value.RootElement);
        if (reference.ValueKind is not JsonValueKind.String ||
            !SchemaResourceSyntax.TryResolveReference(resource.ResourceUri, reference.GetString()!, out var target))
        {
            diagnostics.Add(SchemaDiagnosticCode.InvalidReference, schemaId: document.SchemaId, keywordLocation: location);
            return;
        }

        ReferenceCount++;
        if (ReferenceCount > SchemaValidationLimits.MaximumReferenceEdges)
        {
            diagnostics.Add(SchemaDiagnosticCode.ReferenceLimitExceeded, schemaId: document.SchemaId, keywordLocation: location);
            _hardLimitExceeded = true;
            return;
        }

        pendingReferences.Add(new(resource, pointer, target!, keywordPointer));
    }

    void ScanSingleSchema(
        JsonProperty property,
        string propertyPointer,
        LoadedSchemaDocument document,
        LoadedSchemaResource resource,
        string parentPointer,
        JsonElement parentSchema)
    {
        if (property.Value.ValueKind is not (JsonValueKind.Object or JsonValueKind.True or JsonValueKind.False))
        {
            diagnostics.Add(
                SchemaDiagnosticCode.MalformedSchema,
                schemaId: document.SchemaId,
                keywordLocation: SafeSchemaLocation.FromSchemaPointer(propertyPointer, document.Value.RootElement));
            return;
        }

        document.GraphEdges.Add(new(
            SchemaResourceSyntax.NodeKey(document, parentPointer),
            SchemaResourceSyntax.NodeKey(document, propertyPointer),
            CreateSelector(property.Name, parentSchema),
            false));
        ScanSchema(property.Value, document, resource, propertyPointer);
    }

    void ScanSchemaArray(
        JsonProperty property,
        string propertyPointer,
        LoadedSchemaDocument document,
        LoadedSchemaResource resource,
        string parentPointer)
    {
        if (property.Value.ValueKind is not JsonValueKind.Array)
        {
            diagnostics.Add(
                SchemaDiagnosticCode.MalformedSchema,
                schemaId: document.SchemaId,
                keywordLocation: SafeSchemaLocation.FromSchemaPointer(propertyPointer, document.Value.RootElement));
            return;
        }

        var index = 0;
        foreach (var child in property.Value.EnumerateArray())
        {
            if (_hardLimitExceeded) break;

            var childPointer = SchemaResourceSyntax.CombinePointer(propertyPointer, index.ToString(System.Globalization.CultureInfo.InvariantCulture));
            document.GraphEdges.Add(new(
                SchemaResourceSyntax.NodeKey(document, parentPointer),
                SchemaResourceSyntax.NodeKey(document, childPointer),
                SchemaInstanceSelector.SameInstance,
                false));
            ScanSchema(child, document, resource, childPointer);
            index++;
        }
    }

    void ScanSchemaMap(
        JsonProperty property,
        string propertyPointer,
        LoadedSchemaDocument document,
        LoadedSchemaResource resource,
        string parentPointer)
    {
        if (property.Value.ValueKind is not JsonValueKind.Object)
        {
            diagnostics.Add(
                SchemaDiagnosticCode.MalformedSchema,
                schemaId: document.SchemaId,
                keywordLocation: SafeSchemaLocation.FromSchemaPointer(propertyPointer, document.Value.RootElement));
            return;
        }

        foreach (var child in property.Value.EnumerateObject())
        {
            if (_hardLimitExceeded) break;

            var childPointer = SchemaResourceSyntax.CombinePointer(propertyPointer, child.Name);
            if (string.Equals(property.Name, "properties", StringComparison.Ordinal))
            {
                document.GraphEdges.Add(new(
                    SchemaResourceSyntax.NodeKey(document, parentPointer),
                    SchemaResourceSyntax.NodeKey(document, childPointer),
                    new(SchemaInstanceSelectorKind.NamedProperty, child.Name),
                    false));
            }

            ScanSchema(child.Value, document, resource, childPointer);
        }
    }

    bool TryResolveReferenceTarget(
        PendingSchemaReference pending,
        out LoadedSchemaResource? targetResource,
        out string? targetPointer)
    {
        var absolute = pending.TargetUri.AbsoluteUri;
        var fragmentIndex = absolute.IndexOf('#', StringComparison.Ordinal);
        var baseValue = fragmentIndex < 0 ? absolute : absolute[..fragmentIndex];
        if (!resources.TryGetValue(SchemaResourceSyntax.ResourceKey(new Uri(baseValue, UriKind.Absolute)), out targetResource))
        {
            targetPointer = null;
            return false;
        }

        if (fragmentIndex < 0 || fragmentIndex == absolute.Length - 1)
        {
            targetPointer = targetResource.RootPointer;
            return true;
        }

        string fragment;
        try
        {
            fragment = Uri.UnescapeDataString(absolute[(fragmentIndex + 1)..]);
        }
        catch (UriFormatException)
        {
            targetPointer = null;
            return false;
        }

        if (fragment.Length > 0 && fragment[0] == '/')
        {
            if (!SchemaResourceSyntax.TryNormalizePointer(fragment, out var relativePointer))
            {
                targetPointer = null;
                return false;
            }

            targetPointer = targetResource.RootPointer + relativePointer;
            if (!targetResource.Document.SchemaPointers.Contains(targetPointer)) return false;

            targetResource = targetResource.Document.SchemaPointerResources[targetPointer];
            return true;
        }

        return targetResource.Anchors.TryGetValue(fragment, out targetPointer);
    }

    void CheckReferenceDepth(IReadOnlyList<SchemaGraphEdge> edges)
    {
        var nodes = edges.SelectMany(_ => new[] { _.Source, _.Target }).Distinct(StringComparer.Ordinal).ToArray();
        var incoming = nodes.ToDictionary(_ => _, _ => 0, StringComparer.Ordinal);
        var outgoing = edges.GroupBy(_ => _.Source, StringComparer.Ordinal)
            .ToDictionary(
                _ => _.Key,
                _ => _.OrderBy(edge => edge.Target, StringComparer.Ordinal).ThenBy(edge => edge.IsReference).ToArray(),
                StringComparer.Ordinal);
        foreach (var edge in edges) incoming[edge.Target]++;

        var ready = new SortedSet<string>(nodes.Where(node => incoming[node] == 0), StringComparer.Ordinal);
        var depths = nodes.ToDictionary(_ => _, _ => 0, StringComparer.Ordinal);
        while (ready.Count > 0)
        {
            var source = ready.Min!;
            ready.Remove(source);
            foreach (var edge in outgoing.GetValueOrDefault(source) ?? [])
            {
                depths[edge.Target] = Math.Max(depths[edge.Target], depths[source] + (edge.IsReference ? 1 : 0));
                incoming[edge.Target]--;
                if (incoming[edge.Target] == 0) ready.Add(edge.Target);
            }
        }

        var exceeded = depths.Where(_ => _.Value > SchemaValidationLimits.MaximumReferenceDepth)
            .OrderBy(_ => _.Key, StringComparer.Ordinal)
            .FirstOrDefault();
        if (exceeded.Key is null) return;

        var separator = exceeded.Key.IndexOf('\n', StringComparison.Ordinal);
        var documentId = separator < 0 ? null : exceeded.Key[..separator];
        var pointer = separator < 0 ? string.Empty : exceeded.Key[(separator + 1)..];
        var document = resources.Values.FirstOrDefault(_ => string.Equals(_.Document.SchemaId, documentId, StringComparison.Ordinal))?.Document;
        diagnostics.Add(
            SchemaDiagnosticCode.ReferenceDepthLimitExceeded,
            schemaId: documentId,
            keywordLocation: document is null
                ? "#"
                : SafeSchemaLocation.FromSchemaPointer(pointer, document.Value.RootElement));
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Collections.Frozen;
using System.Text.Json;

namespace Cratis.Factory.SchemaValidation;

static class SchemaSanitizer
{
    static readonly HashSet<string> _singleSchemaKeywords = new(StringComparer.Ordinal)
    {
        "additionalProperties", "contains", "else", "if", "items", "not", "then", "unevaluatedProperties"
    };
    static readonly HashSet<string> _schemaArrayKeywords = new(StringComparer.Ordinal) { "allOf", "anyOf", "oneOf" };
    static readonly HashSet<string> _schemaMapKeywords = new(StringComparer.Ordinal) { "$defs", "properties" };

    public static bool TryPrepare(
        IEnumerable<LoadedSchemaResource> resources,
        out FrozenDictionary<LoadedSchemaResource, SchemaPackageView>? views)
    {
        views = null;
        var prepared = new Dictionary<LoadedSchemaResource, SchemaPackageView>();
        var orderedResources = resources.OrderBy(_ => _.SchemaId, StringComparer.Ordinal).ToArray();
        var referenceTargets = orderedResources.SelectMany(_ => _.References)
            .Select(_ => (_.TargetResource, _.TargetPointer))
            .ToHashSet();
        foreach (var resource in orderedResources)
        {
            if (!TryPrepare(resource, referenceTargets, out var view)) return false;

            prepared.Add(resource, view!);
        }

        views = prepared.ToFrozenDictionary();
        return true;
    }

    static bool TryPrepare(
        LoadedSchemaResource resource,
        HashSet<(LoadedSchemaResource Resource, string Pointer)> referenceTargets,
        out SchemaPackageView? view)
    {
        view = null;
        var origins = new Dictionary<string, SchemaOrigin>(StringComparer.Ordinal);
        var references = new Dictionary<string, SchemaPackageReference>(StringComparer.Ordinal);
        foreach (var edge in resource.Document.Resources.SelectMany(_ => _.References)
                     .Where(_ => SchemaResourceSyntax.IsPointerWithin(resource.RootPointer, _.KeywordPointer))
                     .OrderBy(_ => _.KeywordPointer, StringComparer.Ordinal))
        {
            if (!SchemaResourceSyntax.TryMakeRelativePointer(resource.RootPointer, edge.KeywordPointer, out var sourcePointer) ||
                !SchemaResourceSyntax.TryMakeRelativePointer(edge.TargetResource.RootPointer, edge.TargetPointer, out var targetPointer) ||
                !SchemaResourceSyntax.TryCreateReferenceUri(edge.TargetResource.ResourceUri, targetPointer!, out var rewrittenUri) ||
                !references.TryAdd(sourcePointer!, new(edge, sourcePointer!, targetPointer!, rewrittenUri!)))
            {
                return false;
            }
        }

        var buffer = new ArrayBufferWriter<byte>();
        var observedReferences = 0;
        using (var writer = new Utf8JsonWriter(buffer))
        {
            if (!WriteSchema(
                    writer,
                    resource.Source,
                    resource.RootPointer,
                    string.Empty,
                    resource,
                    referenceTargets,
                    origins,
                    references,
                    ref observedReferences))
            {
                return false;
            }
        }

        if (observedReferences != references.Count) return false;

        using var sanitizedDocument = JsonDocument.Parse(buffer.WrittenMemory);
        view = new(
            resource,
            sanitizedDocument.RootElement.Clone(),
            origins.ToFrozenDictionary(StringComparer.Ordinal),
            references.ToFrozenDictionary(StringComparer.Ordinal));
        return true;
    }

    static bool WriteSchema(
        Utf8JsonWriter writer,
        JsonElement schema,
        string documentPointer,
        string viewPointer,
        LoadedSchemaResource viewResource,
        HashSet<(LoadedSchemaResource Resource, string Pointer)> referenceTargets,
        Dictionary<string, SchemaOrigin> origins,
        IReadOnlyDictionary<string, SchemaPackageReference> references,
        ref int observedReferences)
    {
        if (!viewResource.Document.SchemaPointerResources.TryGetValue(documentPointer, out var owner) ||
            !SchemaResourceSyntax.TryMakeRelativePointer(owner.RootPointer, documentPointer, out var originPointer) ||
            !origins.TryAdd(viewPointer, new(
                owner,
                originPointer!,
                referenceTargets.Contains((owner, documentPointer)),
                schema.ValueKind is JsonValueKind.False)))
        {
            return false;
        }

        if (schema.ValueKind is JsonValueKind.True or JsonValueKind.False)
        {
            schema.WriteTo(writer);
            return true;
        }

        if (schema.ValueKind is not JsonValueKind.Object) return false;

        writer.WriteStartObject();
        foreach (var property in schema.EnumerateObject())
        {
            if (string.Equals(property.Name, "$schema", StringComparison.Ordinal) ||
                string.Equals(property.Name, "$vocabulary", StringComparison.Ordinal))
            {
                continue;
            }

            writer.WritePropertyName(property.Name);
            var documentPropertyPointer = SchemaResourceSyntax.CombinePointer(documentPointer, property.Name);
            var viewPropertyPointer = SchemaResourceSyntax.CombinePointer(viewPointer, property.Name);
            if (string.Equals(property.Name, "$ref", StringComparison.Ordinal))
            {
                if (!references.TryGetValue(viewPropertyPointer, out var reference)) return false;

                writer.WriteStringValue(reference.RewrittenUri.AbsoluteUri);
                observedReferences++;
            }
            else if (_singleSchemaKeywords.Contains(property.Name))
            {
                if (!WriteSchema(
                        writer,
                        property.Value,
                        documentPropertyPointer,
                        viewPropertyPointer,
                        viewResource,
                        referenceTargets,
                        origins,
                        references,
                        ref observedReferences))
                {
                    return false;
                }
            }
            else if (_schemaArrayKeywords.Contains(property.Name))
            {
                writer.WriteStartArray();
                var index = 0;
                foreach (var child in property.Value.EnumerateArray())
                {
                    var segment = index.ToString(System.Globalization.CultureInfo.InvariantCulture);
                    if (!WriteSchema(
                            writer,
                            child,
                            SchemaResourceSyntax.CombinePointer(documentPropertyPointer, segment),
                            SchemaResourceSyntax.CombinePointer(viewPropertyPointer, segment),
                            viewResource,
                            referenceTargets,
                            origins,
                            references,
                            ref observedReferences))
                    {
                        return false;
                    }

                    index++;
                }

                writer.WriteEndArray();
            }
            else if (_schemaMapKeywords.Contains(property.Name))
            {
                writer.WriteStartObject();
                foreach (var child in property.Value.EnumerateObject())
                {
                    writer.WritePropertyName(child.Name);
                    if (!WriteSchema(
                            writer,
                            child.Value,
                            SchemaResourceSyntax.CombinePointer(documentPropertyPointer, child.Name),
                            SchemaResourceSyntax.CombinePointer(viewPropertyPointer, child.Name),
                            viewResource,
                            referenceTargets,
                            origins,
                            references,
                            ref observedReferences))
                    {
                        return false;
                    }
                }

                writer.WriteEndObject();
            }
            else
            {
                property.Value.WriteTo(writer);
            }
        }

        writer.WriteEndObject();
        return true;
    }
}

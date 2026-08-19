// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Json.Pointer;
using Json.Schema;

namespace Cratis.Factory.SchemaValidation;

static class SchemaBuildFinalizer
{
    static readonly HashSet<string> _singleSchemaKeywords = new(StringComparer.Ordinal)
    {
        "additionalProperties", "contains", "else", "if", "items", "not", "then", "unevaluatedProperties"
    };
    static readonly HashSet<string> _schemaArrayKeywords = new(StringComparer.Ordinal) { "allOf", "anyOf", "oneOf" };
    static readonly HashSet<string> _schemaMapKeywords = new(StringComparer.Ordinal) { "$defs", "properties" };

    public static bool IsExpectedRoot(JsonSchema schema, SchemaPackageView view) =>
        JsonElement.DeepEquals(schema.Root.Source, view.Root) &&
        (view.Root.ValueKind is not JsonValueKind.Object || schema.Root.BaseUri == view.Resource.ResourceUri);

    public static bool TryFinalize(
        JsonSchema schema,
        SchemaPackageView view,
        IReadOnlyDictionary<LoadedSchemaResource, LocalSchemaBaseDocument> localDocuments,
        out SchemaDiagnosticCode failure)
    {
        failure = SchemaDiagnosticCode.SchemaBuildFailed;
        var naturalNodes = new Dictionary<string, JsonSchemaNode>(StringComparer.Ordinal);
        var observedReferences = new Dictionary<string, ObservedReference>(StringComparer.Ordinal);
        var pending = new Stack<PendingNaturalNode>();
        var visited = new HashSet<JsonSchemaNode>(ReferenceEqualityComparer.Instance);
        pending.Push(new(schema.Root, string.Empty));
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            var node = current.Node;
            if (!visited.Add(node)) continue;

            var pointer = current.Pointer;
            if (!TryValidateNaturalNode(view, node, pointer, out var origin))
            {
                return false;
            }
            if (!naturalNodes.TryAdd(pointer, node))
            {
                return false;
            }

            if (!TrySetFinalizedPointer(node, pointer)) return false;

            foreach (var keyword in node.Keywords)
            {
                if (keyword.Handler is SafeRefKeyword)
                {
                    var keywordPointer = SchemaResourceSyntax.CombinePointer(pointer, "$ref");
                    if (!view.References.TryGetValue(keywordPointer, out var expected) ||
                        !ReferenceEquals(origin!.Resource, expected.Edge.SourceResource) ||
                        !SchemaResourceSyntax.TryMakeRelativePointer(
                            expected.Edge.SourceResource.RootPointer,
                            expected.Edge.SourcePointer,
                            out var expectedSourcePointer) ||
                        !string.Equals(origin.Pointer, expectedSourcePointer, StringComparison.Ordinal) ||
                        keyword.Value is not Uri targetUri ||
                        keyword.RawValue.ValueKind is not JsonValueKind.String ||
                        !string.Equals(keyword.RawValue.GetString(), expected.RewrittenUri.AbsoluteUri, StringComparison.Ordinal) ||
                        !string.Equals(targetUri.AbsoluteUri, expected.RewrittenUri.AbsoluteUri, StringComparison.Ordinal) ||
                        keyword.Subschemas.Length != 1 ||
                        !observedReferences.TryAdd(keywordPointer, new(expected, keyword.Subschemas[0])))
                    {
                        return false;
                    }

                    continue;
                }

                if (!TryAddNaturalSubschemas(keyword, pointer, pending)) return false;
            }
        }

        if (observedReferences.Count != view.References.Count) return false;

        foreach (var observed in observedReferences.Values)
        {
            if (!TryGetExpectedTarget(schema, view, observed.Reference, naturalNodes, localDocuments, out var expectedTarget) ||
                !ReferenceEquals(observed.Target, expectedTarget))
            {
                failure = SchemaDiagnosticCode.UnresolvedReference;
                return false;
            }
        }

        return true;
    }

    static bool TryAddNaturalSubschemas(
        KeywordData keyword,
        string parentPointer,
        Stack<PendingNaturalNode> pending)
    {
        var keywordPointer = SchemaResourceSyntax.CombinePointer(parentPointer, keyword.Handler.Name);
        if (_singleSchemaKeywords.Contains(keyword.Handler.Name))
        {
            if (keyword.Subschemas.Length != 1) return false;

            pending.Push(new(keyword.Subschemas[0], keywordPointer));
            return true;
        }

        if (_schemaArrayKeywords.Contains(keyword.Handler.Name))
        {
            if (keyword.RawValue.ValueKind is not JsonValueKind.Array ||
                keyword.Subschemas.Length != keyword.RawValue.GetArrayLength())
            {
                return false;
            }

            for (var index = 0; index < keyword.Subschemas.Length; index++)
            {
                pending.Push(new(
                    keyword.Subschemas[index],
                    SchemaResourceSyntax.CombinePointer(
                        keywordPointer,
                        index.ToString(System.Globalization.CultureInfo.InvariantCulture))));
            }

            return true;
        }

        if (_schemaMapKeywords.Contains(keyword.Handler.Name))
        {
            if (keyword.RawValue.ValueKind is not JsonValueKind.Object ||
                keyword.Subschemas.Length != keyword.RawValue.EnumerateObject().Count())
            {
                return false;
            }

            var childPointers = new HashSet<string>(StringComparer.Ordinal);
            foreach (var subschema in keyword.Subschemas)
            {
                var relativePointer = subschema.RelativePath.ToString();
                if (!SchemaResourceSyntax.TryNormalizePointer(relativePointer, out var normalized) ||
                    !string.Equals(relativePointer, normalized, StringComparison.Ordinal) ||
                    relativePointer.Length == 0 ||
                    relativePointer[1..].Contains('/', StringComparison.Ordinal) ||
                    !childPointers.Add(relativePointer))
                {
                    return false;
                }

                pending.Push(new(subschema, $"{keywordPointer}{relativePointer}"));
            }

            return true;
        }

        return keyword.Subschemas.Length == 0;
    }

    static bool TryValidateNaturalNode(
        SchemaPackageView view,
        JsonSchemaNode node,
        string pointer,
        out SchemaOrigin? origin)
    {
        origin = null;
        if (!JsonPointer.TryParse(pointer, out var parsedPointer)) return false;

        var expectedSource = parsedPointer.Evaluate(view.Root);
        return expectedSource is not null &&
               JsonElement.DeepEquals(node.Source, expectedSource.Value) &&
               (node.Source.ValueKind is not JsonValueKind.Object || node.BaseUri == view.Resource.ResourceUri) &&
               view.Origins.TryGetValue(pointer, out origin);
    }

    static bool TryGetExpectedTarget(
        JsonSchema schema,
        SchemaPackageView view,
        SchemaPackageReference reference,
        Dictionary<string, JsonSchemaNode> naturalNodes,
        IReadOnlyDictionary<LoadedSchemaResource, LocalSchemaBaseDocument> localDocuments,
        out JsonSchemaNode? target)
    {
        target = null;
        if (ReferenceEquals(reference.Edge.TargetResource, view.Resource))
        {
            if (!naturalNodes.TryGetValue(reference.TargetPointer, out target)) return false;

            return reference.TargetPointer.Length != 0 || ReferenceEquals(target, schema.Root);
        }

        return JsonPointer.TryParse(reference.TargetPointer, out var pointer) &&
               localDocuments.TryGetValue(reference.Edge.TargetResource, out var localDocument) &&
               localDocument.TryGetBuiltSubschema(pointer, out target);
    }

#pragma warning disable CS0618 // JsonSchema.Net exposes the finalized resource-relative path only through its advanced public API.
    static bool TrySetFinalizedPointer(JsonSchemaNode node, string pointer)
    {
        if (!JsonPointer.TryParse(pointer, out var parsedPointer)) return false;

        node.PathFromResourceRoot = parsedPointer;
        return true;
    }
#pragma warning restore CS0618

    sealed record ObservedReference(
        SchemaPackageReference Reference,
        JsonSchemaNode Target);

    sealed record PendingNaturalNode(
        JsonSchemaNode Node,
        string Pointer);
}

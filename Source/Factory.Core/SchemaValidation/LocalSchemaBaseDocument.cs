// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using System.Text.Json;
using Json.Pointer;
using Json.Schema;

namespace Cratis.Factory.SchemaValidation;

sealed class LocalSchemaBaseDocument(SchemaPackageView view) : IBaseDocument
{
    readonly ConcurrentDictionary<JsonPointer, JsonSchemaNode> _subschemas = new();

    public Uri BaseUri { get; } = view.Resource.ResourceUri;

#pragma warning disable CS0618 // JsonSchema.Net marks advanced pointer context obsolete while IBaseDocument requires it.
    public JsonSchemaNode? FindSubschema(JsonPointer pointer, BuildContext context)
    {
        var localSchema = pointer.Evaluate(view.Root);
        if (localSchema is null) return null;

        return _subschemas.GetOrAdd(
            pointer,
            static (requestedPointer, state) =>
            {
                var localContext = state.Context with
                {
                    LocalSchema = state.LocalSchema,
                    BaseUri = state.Owner.BaseUri,
                    PathFromResourceRoot = requestedPointer
                };
                var node = JsonSchema.BuildNode(localContext);
                node.PathFromResourceRoot = requestedPointer;
                return node;
            },
            (Owner: this, Context: context, LocalSchema: localSchema.Value));
    }
#pragma warning restore CS0618

    public bool TryGetBuiltSubschema(JsonPointer pointer, out JsonSchemaNode? node) =>
        _subschemas.TryGetValue(pointer, out node);
}

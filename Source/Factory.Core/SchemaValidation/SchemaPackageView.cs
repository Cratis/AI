// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Frozen;
using System.Text.Json;

namespace Cratis.Factory.SchemaValidation;

sealed class SchemaPackageView(
    LoadedSchemaResource resource,
    JsonElement root,
    FrozenDictionary<string, SchemaOrigin> origins,
    FrozenDictionary<string, SchemaPackageReference> references)
{
    public LoadedSchemaResource Resource { get; } = resource;

    public JsonElement Root { get; } = root;

    public FrozenDictionary<string, SchemaOrigin> Origins { get; } = origins;

    public FrozenDictionary<string, SchemaPackageReference> References { get; } = references;
}

sealed record SchemaOrigin(
    LoadedSchemaResource Resource,
    string Pointer,
    bool IsReferenceTarget,
    bool IsFalseSchema);

sealed record SchemaPackageReference(
    SchemaReferenceEdge Edge,
    string SourcePointer,
    string TargetPointer,
    Uri RewrittenUri);

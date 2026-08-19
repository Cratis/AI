// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.Factory.Canonicalization;
using Cratis.Factory.Hashing;
using Json.Schema;

namespace Cratis.Factory.SchemaValidation;

enum SchemaInstanceSelectorKind
{
    SameInstance,
    NamedProperty,
    EachArrayItem,
    AdditionalObjectMember,
    EveryObjectValue
}

sealed class LoadedSchemaDocument(string schemaId, Uri resourceUri, CanonicalJsonValue value)
{
    public string SchemaId { get; } = schemaId;
    public Uri ResourceUri { get; } = resourceUri;
    public CanonicalJsonValue Value { get; } = value;
    public Sha256Hash ContentHash { get; } = Sha256Hash.Calculate(value.Utf8);
    public HashSet<string> SchemaPointers { get; } = new(StringComparer.Ordinal);
    public Dictionary<string, LoadedSchemaResource> SchemaPointerResources { get; } = new(StringComparer.Ordinal);
    public List<LoadedSchemaResource> Resources { get; } = [];
    public List<SchemaGraphEdge> GraphEdges { get; } = [];
    public Dictionary<string, SchemaEvaluationCostProfile> EvaluationCostProfiles { get; } = new(StringComparer.Ordinal);
    public JsonSchema? Schema { get; set; }
}

sealed class LoadedSchemaResource(string schemaId, Uri resourceUri, LoadedSchemaDocument document, string rootPointer, JsonElement source)
{
    public string SchemaId { get; } = schemaId;
    public Uri ResourceUri { get; } = resourceUri;
    public LoadedSchemaDocument Document { get; } = document;
    public string RootPointer { get; } = rootPointer;
    public JsonElement Source { get; } = source.Clone();
    public Dictionary<string, string> Anchors { get; } = new(StringComparer.Ordinal);
    public List<SchemaReferenceEdge> References { get; } = [];
    public SchemaPackageView? PackageView { get; set; }
    public JsonSchema? Schema { get; set; }
}

sealed record PendingSchemaReference(
    LoadedSchemaResource SourceResource,
    string SourcePointer,
    Uri TargetUri,
    string KeywordPointer);

sealed record SchemaReferenceEdge(
    LoadedSchemaResource SourceResource,
    LoadedSchemaResource TargetResource,
    string SourcePointer,
    string TargetPointer,
    string KeywordPointer);

sealed record SchemaInstanceSelector(
    SchemaInstanceSelectorKind Kind,
    string? PropertyName = null,
    string[]? ExcludedPropertyNames = null)
{
    public static SchemaInstanceSelector SameInstance { get; } = new(SchemaInstanceSelectorKind.SameInstance);

    public static SchemaInstanceSelector EachArrayItem { get; } = new(SchemaInstanceSelectorKind.EachArrayItem);

    public static SchemaInstanceSelector EveryObjectValue { get; } = new(SchemaInstanceSelectorKind.EveryObjectValue);

    public bool ConsumesInstance => Kind is not SchemaInstanceSelectorKind.SameInstance;
}

sealed record SchemaGraphEdge(
    string Source,
    string Target,
    SchemaInstanceSelector Selector,
    bool IsReference);

sealed record SchemaEvaluationCostProfile(
    long FixedComparisonCost,
    int InstanceComparisonCount,
    int StringScanCount,
    int RequiredPropertyCount,
    long RequiredPropertyNameBytes,
    int DeclaredPropertyCount,
    long DeclaredPropertyNameBytes,
    bool HasAdditionalProperties,
    bool HasUnevaluatedProperties,
    bool HasUniqueItems);

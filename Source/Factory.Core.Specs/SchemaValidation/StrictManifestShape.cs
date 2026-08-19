// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation.Conformance;

static class StrictManifestShape
{
    static readonly string[] _root = ["algorithm", "cases", "contentHash", "description", "documents", "generatorContract", "limits", "protocolVersion"];
    static readonly string[] _limits = ["maximumAggregateSchemaBytes", "maximumAnchorScalars", "maximumAnchors", "maximumDiagnosticInstanceNodes", "maximumDiagnosticWorkUnits", "maximumDiagnostics", "maximumDocuments", "maximumEvaluationWorkUnits", "maximumInstanceNodes", "maximumPatternScalars", "maximumReferenceDepth", "maximumReferenceEdges", "maximumReferenceScalars", "maximumResources", "maximumSchemaIdScalars", "maximumSchemaNodes"];
    static readonly string[] _case = ["expected", "flags", "forbiddenDiagnosticSubstrings", "id", "instanceBase64", "instanceGenerator", "operation", "parallelCount", "repeatCount", "rootSchemaId", "schemaDocuments", "schemaGenerator"];
    static readonly string[] _document = ["inputBase64", "logicalId"];
    static readonly string[] _generator = ["count", "kind", "schemaIdPrefix", "targetBytes"];
    static readonly string[] _expected = ["closure", "diagnostics", "loadStatus", "schemaSet", "validationStatus"];
    static readonly string[] _set = ["anchorCount", "documents", "identity", "referenceCount", "resourceCount", "resources"];
    static readonly string[] _closure = ["anchorCount", "identity", "members", "referenceCount", "resourceCount", "rootSchemaId"];
    static readonly string[] _member = ["contentHash", "referenceCount", "schemaId"];
    static readonly string[] _resource = ["contentHash", "documentId", "referenceCount", "schemaId"];
    static readonly string[] _diagnostic = ["code", "instanceLocation", "keywordLocation", "schemaId", "severity", "status"];

    public static void Validate(ReadOnlySpan<byte> utf8)
    {
        try
        {
            using var document = JsonDocument.Parse(utf8.ToArray());
            RequireProperties(document.RootElement, _root);
            RequireProperties(document.RootElement.GetProperty("limits"), _limits);
            RequireStringMap(document.RootElement.GetProperty("generatorContract"));
            RequireObjectMap(document.RootElement.GetProperty("documents"), _document);

            foreach (var vector in document.RootElement.GetProperty("cases").EnumerateArray())
            {
                RequireProperties(vector, _case);
                RequireOptionalStringArray(vector.GetProperty("schemaDocuments"));
                RequireOptionalObject(vector.GetProperty("schemaGenerator"), _generator);
                RequireOptionalObject(vector.GetProperty("instanceGenerator"), _generator);
                var expected = vector.GetProperty("expected");
                RequireProperties(expected, _expected);
                RequireOptionalSet(expected.GetProperty("schemaSet"));
                RequireOptionalClosure(expected.GetProperty("closure"));
                RequireObjectArray(expected.GetProperty("diagnostics"), _diagnostic);
            }
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or KeyNotFoundException)
        {
            throw new InvalidDataException("The schema validation vector manifest shape is invalid or incomplete.", error);
        }
    }

    static void RequireProperties(JsonElement element, string[] expected)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.EnumerateObject().Select(_ => _.Name).Order(StringComparer.Ordinal).SequenceEqual(expected, StringComparer.Ordinal))
        {
            throw new InvalidDataException("The schema validation vector manifest contains unknown or missing members.");
        }
    }

    static void RequireStringMap(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object || element.EnumerateObject().Any(_ => _.Value.ValueKind != JsonValueKind.String))
        {
            throw new InvalidDataException("The schema validation vector generator contract must be a string map.");
        }
    }

    static void RequireObjectMap(JsonElement element, string[] expected)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidDataException("The schema validation vector documents must be an object map.");
        }

        foreach (var property in element.EnumerateObject())
        {
            RequireProperties(property.Value, expected);
        }
    }

    static void RequireOptionalObject(JsonElement element, string[] expected)
    {
        if (element.ValueKind != JsonValueKind.Null)
        {
            RequireProperties(element, expected);
        }
    }

    static void RequireOptionalStringArray(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Null)
        {
            return;
        }

        if (element.ValueKind != JsonValueKind.Array || element.EnumerateArray().Any(_ => _.ValueKind != JsonValueKind.String))
        {
            throw new InvalidDataException("The schema validation vector schema documents must be a string array.");
        }
    }

    static void RequireObjectArray(JsonElement element, string[] expected)
    {
        if (element.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidDataException("The schema validation vector manifest requires an array.");
        }

        foreach (var item in element.EnumerateArray())
        {
            RequireProperties(item, expected);
        }
    }

    static void RequireOptionalSet(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Null)
        {
            return;
        }

        RequireProperties(element, _set);
        RequireObjectArray(element.GetProperty("documents"), _member);
        RequireObjectArray(element.GetProperty("resources"), _resource);
    }

    static void RequireOptionalClosure(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Null)
        {
            return;
        }

        RequireProperties(element, _closure);
        RequireObjectArray(element.GetProperty("members"), _member);
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.Factory.SchemaValidationParity;

static class StrictOracleShape
{
    static readonly string[] _response = ["closure", "diagnostics", "loadStatus", "parallelDeterministic", "protocolVersion", "repeatDeterministic", "schemaSet", "validationStatus"];
    static readonly string[] _set = ["anchorCount", "documents", "identity", "referenceCount", "resourceCount", "resources"];
    static readonly string[] _closure = ["anchorCount", "identity", "members", "referenceCount", "resourceCount", "rootSchemaId"];
    static readonly string[] _member = ["contentHash", "referenceCount", "schemaId"];
    static readonly string[] _resource = ["contentHash", "documentId", "referenceCount", "schemaId"];
    static readonly string[] _diagnostic = ["code", "instanceLocation", "keywordLocation", "schemaId", "severity", "status"];

    public static void Validate(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            RequireProperties(document.RootElement, _response);
            RequireOptionalSet(document.RootElement.GetProperty("schemaSet"));
            RequireOptionalClosure(document.RootElement.GetProperty("closure"));
            RequireObjectArray(document.RootElement.GetProperty("diagnostics"), _diagnostic);
        }
        catch (Exception error) when (error is JsonException or InvalidOperationException or KeyNotFoundException)
        {
            throw new InvalidMigrationEnvironment();
        }
    }

    static void RequireProperties(JsonElement element, string[] expected)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.EnumerateObject().Select(_ => _.Name).Order(StringComparer.Ordinal).SequenceEqual(expected, StringComparer.Ordinal))
        {
            throw new InvalidMigrationEnvironment();
        }
    }

    static void RequireObjectArray(JsonElement element, string[] expected)
    {
        if (element.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidMigrationEnvironment();
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

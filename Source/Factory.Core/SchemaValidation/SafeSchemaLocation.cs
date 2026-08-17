// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Cratis.Factory.SchemaValidation;

static class SafeSchemaLocation
{
    static readonly HashSet<string> _keywordSegments = new(StringComparer.Ordinal)
    {
        "$anchor", "$comment", "$defs", "$id", "$ref", "$schema", "$vocabulary",
        "additionalProperties", "allOf", "anyOf", "const", "contains", "description", "else", "enum",
        "format", "if", "items", "maxItems", "maxLength", "maximum", "minItems", "minLength", "minimum",
        "not", "oneOf", "pattern", "properties", "required", "then", "title", "type",
        "unevaluatedProperties", "uniqueItems"
    };

    static readonly HashSet<string> _singleSchemaKeywords = new(StringComparer.Ordinal)
    {
        "additionalProperties", "contains", "else", "if", "items", "not", "then", "unevaluatedProperties"
    };
    static readonly HashSet<string> _schemaArrayKeywords = new(StringComparer.Ordinal) { "allOf", "anyOf", "oneOf" };
    static readonly HashSet<string> _schemaMapKeywords = new(StringComparer.Ordinal) { "$defs", "properties" };

    public static string FromInstancePointer(string pointer, JsonElement instanceRoot) => Transform(pointer, instanceRoot, false);

    public static string FromSchemaPointer(string pointer, JsonElement schemaRoot) => Transform(pointer, schemaRoot, true);

    public static string HashSegment(string segment)
    {
        var bytes = Encoding.UTF8.GetBytes(segment);
        return $"@{Convert.ToHexStringLower(SHA256.HashData(bytes))}";
    }

    static string Transform(string pointer, JsonElement root, bool schemaMode)
    {
        if (string.IsNullOrEmpty(pointer) || pointer == "#") return "#";

        var value = pointer[0] == '#' ? pointer[1..] : pointer;
        if (value.Length == 0) return "#";
        if (value[0] != '/') return $"#/{HashSegment(value)}";

        var builder = new StringBuilder("#");
        var current = root;
        var isSchemaObject = schemaMode;
        foreach (var encodedSegment in value[1..].Split('/'))
        {
            var segment = DecodePointerSegment(encodedSegment);
            builder.Append('/');
            if (current.ValueKind == JsonValueKind.Array && IsArrayIndex(segment))
            {
                builder.Append(segment);
                if (int.TryParse(segment, out var index) && index < current.GetArrayLength())
                {
                    current = current[index];
                }

                isSchemaObject = schemaMode;
            }
            else
            {
                var exposeKeyword = schemaMode && isSchemaObject && _keywordSegments.Contains(segment);
                builder.Append(exposeKeyword ? segment : HashSegment(segment));
                if (current.ValueKind == JsonValueKind.Object && current.TryGetProperty(segment, out var child))
                {
                    current = child;
                }

                if (schemaMode)
                {
                    isSchemaObject = isSchemaObject
                        ? _singleSchemaKeywords.Contains(segment)
                        : current.ValueKind is JsonValueKind.Object or JsonValueKind.True or JsonValueKind.False;
                    if (_schemaArrayKeywords.Contains(segment) || _schemaMapKeywords.Contains(segment)) isSchemaObject = false;
                }
            }
        }

        return builder.ToString();
    }

    static string DecodePointerSegment(string segment) => segment.Replace("~1", "/", StringComparison.Ordinal).Replace("~0", "~", StringComparison.Ordinal);

    static bool IsArrayIndex(string value)
    {
        if (value.Length == 0 || (value.Length > 1 && value[0] == '0')) return false;
        foreach (var character in value)
        {
            if (character is < '0' or > '9') return false;
        }

        return true;
    }
}

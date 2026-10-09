// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Validates JSON argument shapes before invoking a caller's function.
/// </summary>
internal static class ClaudeCodeToolArguments
{
    /// <summary>
    /// Checks required fields, primitive types, arrays and nested object shapes.
    /// </summary>
    /// <param name="value">Supplied arguments.</param>
    /// <param name="schema">Function input schema.</param>
    /// <returns>Whether the arguments have the required shape.</returns>
    internal static bool IsValid(JsonElement value, JsonElement schema)
    {
        if (schema.ValueKind == JsonValueKind.False) return false;
        if (schema.ValueKind != JsonValueKind.Object) return true;
        if (schema.TryGetProperty("type", out var type))
        {
            var matches = type.ValueKind == JsonValueKind.Array
                ? type.EnumerateArray().Any(candidate => MatchesType(value, candidate.GetString()))
                : MatchesType(value, type.GetString());
            if (!matches) return false;
        }

        if (schema.TryGetProperty("enum", out var allowed) && !allowed.EnumerateArray().Any(candidate => JsonElement.DeepEquals(value, candidate))) return false;
        if (schema.TryGetProperty("anyOf", out var alternatives) && !alternatives.EnumerateArray().Any(candidate => IsValid(value, candidate))) return false;
        if (value.ValueKind == JsonValueKind.Object)
        {
            if (schema.TryGetProperty("required", out var required) && required.EnumerateArray().Any(name => !value.TryGetProperty(name.GetString()!, out _))) return false;
            schema.TryGetProperty("properties", out var properties);
            foreach (var property in value.EnumerateObject())
            {
                if (properties.ValueKind == JsonValueKind.Object && properties.TryGetProperty(property.Name, out var propertySchema))
                {
                    if (!IsValid(property.Value, propertySchema)) return false;
                }
                else if (schema.TryGetProperty("additionalProperties", out var additional) && !IsValid(property.Value, additional))
                {
                    return false;
                }
            }
        }

        return value.ValueKind != JsonValueKind.Array || !schema.TryGetProperty("items", out var items) || value.EnumerateArray().All(item => IsValid(item, items));
    }

    static bool MatchesType(JsonElement value, string? type) => type switch
    {
        "object" => value.ValueKind == JsonValueKind.Object,
        "array" => value.ValueKind == JsonValueKind.Array,
        "string" => value.ValueKind == JsonValueKind.String,
        "boolean" => value.ValueKind is JsonValueKind.True or JsonValueKind.False,
        "number" => value.ValueKind == JsonValueKind.Number,
        "integer" => value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number) && decimal.Truncate(number) == number,
        "null" => value.ValueKind == JsonValueKind.Null,
        _ => false,
    };
}

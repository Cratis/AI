// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using System.Text.Json;

namespace Cratis.Factory.SchemaValidation;

static class SchemaValidationCostModel
{
    public const long BaseSchemaPositionCost = 1;
    public const long ReferenceRuntimeCost = 1;

    public static SchemaEvaluationCostProfile CreateProfile(JsonElement schema)
    {
        if (schema.ValueKind is not JsonValueKind.Object)
        {
            return new(0, 0, 0, 0, 0, 0, 0, false, false, false);
        }

        long fixedComparisonCost = 0;
        var instanceComparisonCount = 0;
        if (schema.TryGetProperty("const", out var constant))
        {
            fixedComparisonCost = SchemaInstanceGraph.MeasureValue(constant);
            instanceComparisonCount++;
        }

        if (schema.TryGetProperty("enum", out var enumeration) && enumeration.ValueKind is JsonValueKind.Array)
        {
            foreach (var candidate in enumeration.EnumerateArray())
            {
                fixedComparisonCost = SaturatingAdd(fixedComparisonCost, SchemaInstanceGraph.MeasureValue(candidate));
                instanceComparisonCount++;
            }
        }

        var stringScanCount = 0;
        if (schema.TryGetProperty("minLength", out _)) stringScanCount++;
        if (schema.TryGetProperty("maxLength", out _)) stringScanCount++;
        if (schema.TryGetProperty("pattern", out _)) stringScanCount++;
        if (schema.TryGetProperty("format", out var format) &&
            format.ValueKind is JsonValueKind.String &&
            string.Equals(format.GetString(), "uuid", StringComparison.Ordinal))
        {
            stringScanCount++;
        }

        var requiredNames = schema.TryGetProperty("required", out var required) && required.ValueKind is JsonValueKind.Array
            ? required.EnumerateArray().Where(_ => _.ValueKind is JsonValueKind.String).Select(_ => _.GetString()!).ToArray()
            : [];
        var declaredNames = schema.TryGetProperty("properties", out var properties) && properties.ValueKind is JsonValueKind.Object
            ? properties.EnumerateObject().Select(_ => _.Name).ToArray()
            : [];
        var hasUniqueItems = schema.TryGetProperty("uniqueItems", out var uniqueItems) &&
                             uniqueItems.ValueKind is JsonValueKind.True;
        return new(
            fixedComparisonCost,
            instanceComparisonCount,
            stringScanCount,
            requiredNames.Length,
            requiredNames.Sum(Encoding.UTF8.GetByteCount),
            declaredNames.Length,
            declaredNames.Sum(Encoding.UTF8.GetByteCount),
            schema.TryGetProperty("additionalProperties", out _),
            schema.TryGetProperty("unevaluatedProperties", out _),
            hasUniqueItems);
    }

    public static long MeasureState(
        SchemaEvaluationCostProfile profile,
        SchemaInstanceGraph.SchemaInstanceNode instance,
        IReadOnlyList<SchemaInstanceGraph.SchemaInstanceNode> instanceNodes,
        long priorSameInstanceResults)
    {
        var cost = SaturatingAdd(BaseSchemaPositionCost, profile.FixedComparisonCost);
        cost = SaturatingAdd(cost, SaturatingMultiply(profile.InstanceComparisonCount, instance.ValueCost));
        if (profile.StringScanCount > 0 && instance.Value.ValueKind is JsonValueKind.String)
        {
            cost = SaturatingAdd(
                cost,
                SaturatingMultiply(profile.StringScanCount, DivideRoundUp(instance.CanonicalByteCount, 64)));
        }

        if (instance.Value.ValueKind is JsonValueKind.Object)
        {
            var propertyCount = instance.Children.Count;
            long propertyNameBytes = 0;
            foreach (var child in instance.Children)
            {
                propertyNameBytes = SaturatingAdd(
                    propertyNameBytes,
                    Encoding.UTF8.GetByteCount(instanceNodes[child].PropertyName!));
            }

            cost = SaturatingAdd(cost, MeasureNamedPropertyScans(
                profile.RequiredPropertyCount,
                profile.RequiredPropertyNameBytes,
                propertyCount,
                propertyNameBytes));
            cost = SaturatingAdd(cost, MeasureNamedPropertyScans(
                profile.DeclaredPropertyCount,
                profile.DeclaredPropertyNameBytes,
                propertyCount,
                propertyNameBytes));
            if (profile.HasAdditionalProperties)
            {
                cost = SaturatingAdd(cost, propertyCount + DivideRoundUp(propertyNameBytes, 64));
            }
            if (profile.HasUnevaluatedProperties)
            {
                cost = SaturatingAdd(cost, propertyCount + DivideRoundUp(propertyNameBytes, 64));
                cost = SaturatingAdd(cost, priorSameInstanceResults);
            }
        }

        if (profile.HasUniqueItems && instance.Value.ValueKind is JsonValueKind.Array)
        {
            foreach (var child in instance.Children)
            {
                cost = SaturatingAdd(cost, instanceNodes[child].ValueCost);
            }
        }

        return cost;
    }

    public static long SaturatingAdd(long left, long right)
    {
        const long ceiling = (long)SchemaValidationLimits.MaximumEvaluationWorkUnits + 1;
        if (left >= ceiling || right >= ceiling || right > ceiling - left) return ceiling;

        return left + right;
    }

    public static long SaturatingMultiply(long left, long right)
    {
        const long ceiling = (long)SchemaValidationLimits.MaximumEvaluationWorkUnits + 1;
        if (left == 0 || right == 0) return 0;
        if (left >= ceiling || right >= ceiling || left > ceiling / right) return ceiling;

        return left * right;
    }

    static long MeasureNamedPropertyScans(
        int schemaPropertyCount,
        long schemaPropertyNameBytes,
        int instancePropertyCount,
        long instancePropertyNameBytes)
    {
        if (schemaPropertyCount == 0) return 0;

        var comparisons = SaturatingMultiply(schemaPropertyCount, Math.Max(1, instancePropertyCount));
        var bytes = SaturatingAdd(
            SaturatingMultiply(schemaPropertyCount, instancePropertyNameBytes),
            SaturatingMultiply(instancePropertyCount, schemaPropertyNameBytes));
        return SaturatingAdd(comparisons, DivideRoundUp(bytes, 64));
    }

    static long DivideRoundUp(long value, long divisor) => (value + divisor - 1) / divisor;
}

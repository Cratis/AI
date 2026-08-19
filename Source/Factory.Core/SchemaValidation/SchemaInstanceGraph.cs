// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.Factory.SchemaValidation;

sealed class SchemaInstanceGraph
{
    SchemaInstanceGraph(SchemaInstanceNode[] nodes, bool nodeLimitExceeded)
    {
        Nodes = nodes;
        NodeLimitExceeded = nodeLimitExceeded;
    }

    public SchemaInstanceNode[] Nodes { get; }

    public bool NodeLimitExceeded { get; }

    public static SchemaInstanceGraph Create(JsonElement root, int maximumNodes = SchemaValidationLimits.MaximumInstanceNodes)
    {
        var nodes = new List<SchemaInstanceNode> { new(root, null) };
        for (var index = 0; index < nodes.Count; index++)
        {
            var current = nodes[index];
            if (current.Value.ValueKind is JsonValueKind.Array)
            {
                foreach (var item in current.Value.EnumerateArray())
                {
                    current.Children.Add(nodes.Count);
                    nodes.Add(new(item, null));
                    if (nodes.Count > maximumNodes)
                    {
                        return new([.. nodes], true);
                    }
                }
            }
            else if (current.Value.ValueKind is JsonValueKind.Object)
            {
                foreach (var property in current.Value.EnumerateObject())
                {
                    current.Children.Add(nodes.Count);
                    nodes.Add(new(property.Value, property.Name));
                    if (nodes.Count > maximumNodes)
                    {
                        return new([.. nodes], true);
                    }
                }
            }
        }

        for (var index = nodes.Count - 1; index >= 0; index--)
        {
            nodes[index].CalculateValueCost(nodes);
        }

        return new([.. nodes], false);
    }

    public static long MeasureValue(JsonElement value)
    {
        var graph = Create(value, int.MaxValue);
        return graph.Nodes[0].ValueCost;
    }

    public sealed class SchemaInstanceNode(JsonElement value, string? propertyName)
    {
        public JsonElement Value { get; } = value;

        public string? PropertyName { get; } = propertyName;

        public List<int> Children { get; } = [];

        public long ValueCost { get; private set; }

        public long CanonicalByteCount { get; private set; }

        public void CalculateValueCost(IReadOnlyList<SchemaInstanceNode> nodes)
        {
            long nodeCount = 1;
            var canonicalBytes = ScalarCanonicalByteCount(Value);
            if (Value.ValueKind is JsonValueKind.Array)
            {
                canonicalBytes = 2 + Math.Max(0, Children.Count - 1);
                foreach (var child in Children)
                {
                    nodeCount += nodes[child].ValueCost - DivideRoundUp(nodes[child].CanonicalByteCount, 64);
                    canonicalBytes += nodes[child].CanonicalByteCount;
                }
            }
            else if (Value.ValueKind is JsonValueKind.Object)
            {
                canonicalBytes = 2 + Math.Max(0, Children.Count - 1);
                foreach (var child in Children)
                {
                    var childNode = nodes[child];
                    nodeCount += childNode.ValueCost - DivideRoundUp(childNode.CanonicalByteCount, 64);
                    canonicalBytes += CanonicalStringByteCount(childNode.PropertyName!) + 1 + childNode.CanonicalByteCount;
                }
            }

            CanonicalByteCount = canonicalBytes;
            ValueCost = nodeCount + DivideRoundUp(canonicalBytes, 64);
        }

        static long ScalarCanonicalByteCount(JsonElement value) => value.ValueKind switch
        {
            JsonValueKind.String => CanonicalStringByteCount(value.GetString()!),
            JsonValueKind.Number => CanonicalNumberByteCount(value),
            JsonValueKind.True => 4,
            JsonValueKind.False => 5,
            JsonValueKind.Null => 4,
            _ => 0
        };

        static int CanonicalNumberByteCount(JsonElement value)
        {
            var number = value.GetRawText();
            return string.Equals(number, "-0", StringComparison.Ordinal) ? 1 : number.Length;
        }

        static long CanonicalStringByteCount(string value)
        {
            long length = 2;
            foreach (var rune in value.EnumerateRunes())
            {
                length += rune.Value switch
                {
                    '"' or '\\' or '\b' or '\t' or '\n' or '\f' or '\r' => 2,
                    < 0x20 => 6,
                    _ => rune.Utf8SequenceLength
                };
            }

            return length;
        }

        static long DivideRoundUp(long value, long divisor) => (value + divisor - 1) / divisor;
    }
}

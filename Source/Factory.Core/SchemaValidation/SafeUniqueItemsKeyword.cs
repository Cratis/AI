// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers.Binary;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;
using Cratis.Factory.Canonicalization;
using Json.Schema;
using Json.Schema.Keywords;

namespace Cratis.Factory.SchemaValidation;

sealed class SafeUniqueItemsKeyword : UniqueItemsKeyword
{
    const string DuplicateMarker = "factory-unique-items";

    public static new SafeUniqueItemsKeyword Instance { get; } = new();

    public override KeywordEvaluation Evaluate(KeywordData keyword, EvaluationContext context)
    {
        if (context.Instance.ValueKind is not JsonValueKind.Array || keyword.RawValue.ValueKind is JsonValueKind.False)
        {
            return KeywordEvaluation.Ignore;
        }

        if (context.Options is not SafeEvaluationOptions options) throw new SchemaEvaluationBudgetExceeded();

        var values = new Dictionary<CanonicalDigest, List<byte[]>>();
        foreach (var item in context.Instance.EnumerateArray())
        {
            if (!options.RuntimeBudget.TryConsume(SchemaInstanceGraph.MeasureValue(item)))
            {
                throw new SchemaEvaluationBudgetExceeded();
            }

            var canonical = CanonicalJsonWriter.Write(item);
            var digest = CanonicalDigest.Calculate(canonical);
            if (values.TryGetValue(digest, out var collisions))
            {
                if (collisions.Exists(existing => existing.AsSpan().SequenceEqual(canonical)))
                {
                    return new()
                    {
                        Keyword = Name,
                        IsValid = false,
                        Error = DuplicateMarker
                    };
                }

                collisions.Add(canonical);
            }
            else
            {
                values.Add(digest, [canonical]);
            }
        }

        return new()
        {
            Keyword = Name,
            IsValid = true
        };
    }

    [StructLayout(LayoutKind.Auto)]
    readonly record struct CanonicalDigest(ulong Part0, ulong Part1, ulong Part2, ulong Part3)
    {
        public static CanonicalDigest Calculate(ReadOnlySpan<byte> value)
        {
            Span<byte> digest = stackalloc byte[32];
            SHA256.HashData(value, digest);
            return new(
                BinaryPrimitives.ReadUInt64BigEndian(digest),
                BinaryPrimitives.ReadUInt64BigEndian(digest[8..]),
                BinaryPrimitives.ReadUInt64BigEndian(digest[16..]),
                BinaryPrimitives.ReadUInt64BigEndian(digest[24..]));
        }
    }
}

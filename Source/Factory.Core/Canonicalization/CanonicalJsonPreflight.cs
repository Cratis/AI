// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Text;

namespace Cratis.Factory.Canonicalization;

static class CanonicalJsonPreflight
{
    const int MaximumReportedDepth = CanonicalJsonLimits.MaximumNestingDepth + 1;

    public static CanonicalJsonFailure? Validate(ReadOnlySpan<byte> input)
    {
        var failure = ValidateEnvelope(input);
        if (failure is not null)
        {
            return failure;
        }

        var structuralOverflowPosition = InspectStructure(input, out failure);
        if (failure is not null)
        {
            return failure;
        }

        failure = CanonicalJsonTokenValidator.Validate(input);
        return failure ?? (structuralOverflowPosition is null
            ? null
            : new(CanonicalJsonFailureCode.StructuralTokenLimitExceeded, structuralOverflowPosition));
    }

    static CanonicalJsonFailure? ValidateEnvelope(ReadOnlySpan<byte> input)
    {
        if (input.Length > CanonicalJsonLimits.MaximumInputBytes)
        {
            return new(CanonicalJsonFailureCode.InputTooLarge, CanonicalJsonLimits.MaximumInputBytes);
        }

        if (input.Length >= 3 && input[0] == 0xef && input[1] == 0xbb && input[2] == 0xbf)
        {
            return new(CanonicalJsonFailureCode.ByteOrderMarkNotAllowed, 0);
        }

        var remaining = input;
        var position = 0;
        while (!remaining.IsEmpty)
        {
            var status = Rune.DecodeFromUtf8(remaining, out _, out var consumed);
            if (status != OperationStatus.Done)
            {
                return new(CanonicalJsonFailureCode.MalformedUtf8, position);
            }

            position += consumed;
            remaining = remaining[consumed..];
        }

        return null;
    }

    static int? InspectStructure(ReadOnlySpan<byte> input, out CanonicalJsonFailure? failure)
    {
        var depth = 0;
        var structuralTokens = 0;
        int? structuralOverflowPosition = null;
        var inString = false;
        var escaped = false;

        for (var position = 0; position < input.Length; position++)
        {
            var value = input[position];
            if (inString)
            {
                if (escaped)
                {
                    escaped = false;
                }
                else if (value == (byte)'\\')
                {
                    escaped = true;
                }
                else if (value == (byte)'"')
                {
                    inString = false;
                }

                continue;
            }

            if (value == (byte)'"')
            {
                inString = true;
                continue;
            }

            if (value is (byte)'{' or (byte)'[')
            {
                depth++;
                structuralTokens++;
                if (depth > CanonicalJsonLimits.MaximumNestingDepth)
                {
                    failure = new(
                        CanonicalJsonFailureCode.NestingTooDeep,
                        position,
                        Math.Min(depth, MaximumReportedDepth));
                    return structuralOverflowPosition;
                }
            }
            else if (value is (byte)'}' or (byte)']' or (byte)',' or (byte)':')
            {
                structuralTokens++;
                if (value is (byte)'}' or (byte)']')
                {
                    depth--;
                }
            }

            if (structuralTokens > CanonicalJsonLimits.MaximumStructuralTokens && structuralOverflowPosition is null)
            {
                structuralOverflowPosition = position;
            }
        }

        failure = null;
        return structuralOverflowPosition;
    }
}

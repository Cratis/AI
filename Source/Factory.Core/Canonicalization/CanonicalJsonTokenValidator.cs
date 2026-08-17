// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers;
using System.Buffers.Text;
using System.Text;
using System.Text.Json;

namespace Cratis.Factory.Canonicalization;

static class CanonicalJsonTokenValidator
{
    const int MaximumReportedDepth = CanonicalJsonLimits.MaximumNestingDepth + 1;

    public static CanonicalJsonFailure? Validate(ReadOnlySpan<byte> input)
    {
        var containers = new ContainerState?[CanonicalJsonLimits.MaximumNestingDepth];
        var containerCount = 0;
        var sawRootValue = false;
        var reader = new Utf8JsonReader(
            input,
            new JsonReaderOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = CanonicalJsonLimits.MaximumNestingDepth
            });

        try
        {
            while (reader.Read())
            {
                var tokenPosition = ClampPosition(reader.TokenStartIndex, input.Length);
                if (reader.TokenType == JsonTokenType.PropertyName)
                {
                    var name = reader.GetString()!;
                    var failure = ValidateString(name, tokenPosition);
                    if (failure is not null)
                    {
                        return failure;
                    }

                    var container = containers[containerCount - 1]!;
                    container.ItemCount++;
                    if (container.ItemCount > CanonicalJsonLimits.MaximumObjectMembers)
                    {
                        return new(CanonicalJsonFailureCode.ObjectMemberLimitExceeded, tokenPosition, containerCount);
                    }

                    container.Keys ??= new(StringComparer.Ordinal);
                    if (!container.Keys.Add(name))
                    {
                        return new(CanonicalJsonFailureCode.DuplicateObjectKey, tokenPosition, containerCount);
                    }

                    continue;
                }

                if (IsValueToken(reader.TokenType))
                {
                    if (containerCount == 0)
                    {
                        if (sawRootValue)
                        {
                            return new(CanonicalJsonFailureCode.MalformedJson, tokenPosition);
                        }

                        sawRootValue = true;
                    }
                    else if (containers[containerCount - 1]!.Kind == JsonTokenType.StartArray)
                    {
                        var container = containers[containerCount - 1]!;
                        container.ItemCount++;
                        if (container.ItemCount > CanonicalJsonLimits.MaximumArrayItems)
                        {
                            return new(CanonicalJsonFailureCode.ArrayItemLimitExceeded, tokenPosition, containerCount);
                        }
                    }
                }

                switch (reader.TokenType)
                {
                    case JsonTokenType.StartObject:
                        containers[containerCount++] = new(JsonTokenType.StartObject);
                        break;
                    case JsonTokenType.StartArray:
                        containers[containerCount++] = new(JsonTokenType.StartArray);
                        break;
                    case JsonTokenType.EndObject:
                    case JsonTokenType.EndArray:
                        containers[--containerCount] = null;
                        break;
                    case JsonTokenType.String:
                    {
                        var failure = ValidateString(reader.GetString()!, tokenPosition);
                        if (failure is not null)
                        {
                            return failure;
                        }

                        break;
                    }
                    case JsonTokenType.Number:
                    {
                        var failure = ValidateNumber(reader.ValueSpan, tokenPosition, containerCount);
                        if (failure is not null)
                        {
                            return failure;
                        }

                        break;
                    }
                }
            }
        }
        catch (JsonException error)
        {
            return new(
                CanonicalJsonFailureCode.MalformedJson,
                GetAbsolutePosition(input, error.LineNumber, error.BytePositionInLine, reader.BytesConsumed),
                Math.Min(reader.CurrentDepth, MaximumReportedDepth));
        }
        catch (InvalidOperationException)
        {
            return new(
                CanonicalJsonFailureCode.InvalidUnicodeScalar,
                ClampPosition(reader.TokenStartIndex, input.Length),
                Math.Min(reader.CurrentDepth, MaximumReportedDepth));
        }

        return sawRootValue
            ? null
            : new(CanonicalJsonFailureCode.MalformedJson, 0, 0);
    }

    static CanonicalJsonFailure? ValidateString(string value, int position)
    {
        var scalars = 0;
        var remaining = value.AsSpan();
        while (!remaining.IsEmpty)
        {
            var status = Rune.DecodeFromUtf16(remaining, out _, out var consumed);
            if (status != OperationStatus.Done)
            {
                return new(CanonicalJsonFailureCode.InvalidUnicodeScalar, position);
            }

            scalars++;
            if (scalars > CanonicalJsonLimits.MaximumStringScalars)
            {
                return new(CanonicalJsonFailureCode.StringTooLong, position);
            }

            remaining = remaining[consumed..];
        }

        return null;
    }

    static CanonicalJsonFailure? ValidateNumber(ReadOnlySpan<byte> value, int position, int depth)
    {
        if (value.IndexOfAny((byte)'.', (byte)'e', (byte)'E') >= 0)
        {
            return new(CanonicalJsonFailureCode.UnsupportedNumber, position, depth);
        }

        if (!Utf8Parser.TryParse(value, out long parsed, out var consumed) ||
            consumed != value.Length ||
            parsed < -CanonicalJsonLimits.MaximumSafeInteger ||
            parsed > CanonicalJsonLimits.MaximumSafeInteger)
        {
            return new(CanonicalJsonFailureCode.IntegerOutOfRange, position, depth);
        }

        return null;
    }

    static bool IsValueToken(JsonTokenType tokenType) => tokenType is
        JsonTokenType.StartObject or
        JsonTokenType.StartArray or
        JsonTokenType.String or
        JsonTokenType.Number or
        JsonTokenType.True or
        JsonTokenType.False or
        JsonTokenType.Null;

    static int ClampPosition(long position, int inputLength) => (int)Math.Clamp(position, 0, inputLength);

    static int GetAbsolutePosition(
        ReadOnlySpan<byte> input,
        long? lineNumber,
        long? bytePositionInLine,
        long fallback)
    {
        if (lineNumber is null || bytePositionInLine is null || lineNumber < 0 || bytePositionInLine < 0)
        {
            return ClampPosition(fallback, input.Length);
        }

        var currentLine = 0L;
        var lineStart = 0;
        while (currentLine < lineNumber && lineStart < input.Length)
        {
            var newline = input[lineStart..].IndexOf((byte)'\n');
            if (newline < 0)
            {
                return ClampPosition(fallback, input.Length);
            }

            lineStart += newline + 1;
            currentLine++;
        }

        return currentLine == lineNumber
            ? ClampPosition(lineStart + bytePositionInLine.Value, input.Length)
            : ClampPosition(fallback, input.Length);
    }

    sealed class ContainerState(JsonTokenType kind)
    {
        public JsonTokenType Kind { get; } = kind;

        public HashSet<string>? Keys { get; set; }

        public int ItemCount { get; set; }
    }
}

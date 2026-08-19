// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics.CodeAnalysis;
using System.Text.Json;

namespace Cratis.Factory.Canonicalization;

/// <summary>
/// Parses strict UTF-8 into the bounded Factory canonical JSON version 1 value domain.
/// </summary>
public static class CanonicalJson
{
    /// <summary>
    /// Parses and canonicalizes exactly one strict UTF-8 JSON value.
    /// </summary>
    /// <param name="utf8Json">The JSON bytes without a byte order mark.</param>
    /// <returns>An immutable canonical value.</returns>
    /// <exception cref="InvalidCanonicalJson">Thrown when the input is outside the bounded canonical value domain.</exception>
    public static CanonicalJsonValue Parse(ReadOnlySpan<byte> utf8Json)
    {
        if (!TryParse(utf8Json, out var value, out var failure))
        {
            throw new InvalidCanonicalJson(failure);
        }

        return value;
    }

    /// <summary>
    /// Attempts to parse and canonicalize exactly one strict UTF-8 JSON value.
    /// </summary>
    /// <param name="utf8Json">The JSON bytes without a byte order mark.</param>
    /// <param name="value">The immutable canonical value when parsing succeeds.</param>
    /// <param name="failure">Bounded rejection information when parsing fails.</param>
    /// <returns><see langword="true"/> when parsing succeeds; otherwise, <see langword="false"/>.</returns>
    public static bool TryParse(
        ReadOnlySpan<byte> utf8Json,
        [NotNullWhen(true)] out CanonicalJsonValue? value,
        [NotNullWhen(false)] out CanonicalJsonFailure? failure)
    {
        failure = CanonicalJsonPreflight.Validate(utf8Json);
        if (failure is not null)
        {
            value = null;
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(
                utf8Json.ToArray(),
                new JsonDocumentOptions
                {
                    AllowTrailingCommas = false,
                    CommentHandling = JsonCommentHandling.Disallow,
                    MaxDepth = CanonicalJsonLimits.MaximumNestingDepth
                });
            var canonicalBytes = CanonicalJsonWriter.Write(document.RootElement);
            using var canonicalDocument = JsonDocument.Parse(canonicalBytes);
            value = new(canonicalBytes, canonicalDocument.RootElement.Clone());
            return true;
        }
        catch (InvalidCanonicalJson error)
        {
            failure = error.Failure;
        }
        catch (JsonException)
        {
            failure = new(CanonicalJsonFailureCode.MalformedJson);
        }

        value = null;
        return false;
    }
}

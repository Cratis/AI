// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;

namespace Cratis.Factory.SchemaValidation;

static class SchemaResourceSyntax
{
    public static bool ContainsCycle(
        string node,
        IReadOnlyDictionary<string, string[]> adjacency,
        IDictionary<string, int> states)
    {
        if (states.TryGetValue(node, out var existingState)) return existingState == 1;

        var pending = new Stack<(string Node, int NextTarget)>();
        states[node] = 1;
        pending.Push((node, 0));
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            var targets = adjacency.GetValueOrDefault(current.Node) ?? [];
            if (current.NextTarget == targets.Length)
            {
                states[current.Node] = 2;
                continue;
            }

            pending.Push((current.Node, current.NextTarget + 1));
            var target = targets[current.NextTarget];
            if (states.TryGetValue(target, out var targetState))
            {
                if (targetState == 1) return true;
                continue;
            }

            states[target] = 1;
            pending.Push((target, 0));
        }

        return false;
    }

    public static string CombinePointer(string pointer, string segment) => $"{pointer}/{EscapePointerSegment(segment)}";

    public static bool IsPointerWithin(string rootPointer, string pointer) =>
        rootPointer.Length == 0 ||
        string.Equals(rootPointer, pointer, StringComparison.Ordinal) ||
        (pointer.Length > rootPointer.Length &&
         pointer.StartsWith(rootPointer, StringComparison.Ordinal) &&
         pointer[rootPointer.Length] == '/');

    public static bool TryMakeRelativePointer(string rootPointer, string pointer, out string? relativePointer)
    {
        relativePointer = null;
        if (!IsPointerWithin(rootPointer, pointer)) return false;

        relativePointer = rootPointer.Length == 0 ? pointer : pointer[rootPointer.Length..];
        return true;
    }

    public static bool TryCreateReferenceUri(Uri resourceUri, string pointer, out Uri? referenceUri)
    {
        referenceUri = null;
        if (pointer.Length == 0)
        {
            referenceUri = resourceUri;
            return true;
        }

        if (pointer[0] != '/' || !TryNormalizePointer(pointer, out var normalized) ||
            !string.Equals(pointer, normalized, StringComparison.Ordinal))
        {
            return false;
        }

        string encodedPointer;
        try
        {
            encodedPointer = $"/{string.Join('/', pointer[1..].Split('/').Select(Uri.EscapeDataString))}";
        }
        catch (UriFormatException)
        {
            return false;
        }

        var value = $"{resourceUri.AbsoluteUri}#{encodedPointer}";
        if (!Uri.TryCreate(value, UriKind.Absolute, out var candidate) ||
            !TryReadReferencePointer(candidate, resourceUri, out var decodedPointer) ||
            !string.Equals(decodedPointer, pointer, StringComparison.Ordinal))
        {
            return false;
        }

        referenceUri = candidate;
        return true;
    }

    public static bool TryReadSchemaLocation(Uri location, out string? resourceUri, out string? pointer)
    {
        resourceUri = null;
        pointer = null;
        var absolute = location.AbsoluteUri;
        var fragmentIndex = absolute.IndexOf('#', StringComparison.Ordinal);
        resourceUri = fragmentIndex < 0 ? absolute : absolute[..fragmentIndex];
        if (fragmentIndex < 0 || fragmentIndex == absolute.Length - 1)
        {
            pointer = string.Empty;
            return true;
        }

        string decoded;
        try
        {
            decoded = Uri.UnescapeDataString(absolute[(fragmentIndex + 1)..]);
        }
        catch (UriFormatException)
        {
            return false;
        }

        return decoded.Length > 0 && decoded[0] == '/' && TryNormalizePointer(decoded, out pointer);
    }

    public static bool IsValidAnchor(string value)
    {
        if (value.Length == 0 || value.EnumerateRunes().Count() > SchemaValidationLimits.MaximumAnchorScalars) return false;
        if (!IsAnchorStart(value[0])) return false;
        for (var index = 1; index < value.Length; index++)
        {
            var character = value[index];
            if (!IsAnchorStart(character) && character is not (>= '0' and <= '9') and not '-' and not '.') return false;
        }

        return true;
    }

    public static string NodeKey(LoadedSchemaDocument document, string pointer) => $"{document.SchemaId}\n{pointer}";

    public static string ResourceKey(Uri uri)
    {
        var absolute = uri.AbsoluteUri;
        var fragment = absolute.IndexOf('#', StringComparison.Ordinal);
        return fragment < 0 ? absolute : absolute[..fragment];
    }

    public static bool TryCreateAbsoluteSchemaId(string? value, out Uri? uri)
    {
        uri = null;
        if (string.IsNullOrEmpty(value) ||
            value.Length > SchemaValidationLimits.MaximumSchemaIdScalars * 2 ||
            value.EnumerateRunes().Count() > SchemaValidationLimits.MaximumSchemaIdScalars ||
            ContainsUnsafeIdentifierCharacter(value) ||
            !Uri.TryCreate(value, UriKind.Absolute, out var candidate) ||
            !string.Equals(candidate.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            !string.IsNullOrEmpty(candidate.Fragment) ||
            !string.IsNullOrEmpty(candidate.Query) ||
            !string.IsNullOrEmpty(candidate.UserInfo))
        {
            return false;
        }

        uri = candidate;
        return true;
    }

    public static bool TryNormalizePointer(string pointer, out string? normalized)
    {
        if (pointer.Length == 0)
        {
            normalized = string.Empty;
            return true;
        }

        if (pointer[0] != '/')
        {
            normalized = null;
            return false;
        }

        var builder = new StringBuilder();
        foreach (var encodedSegment in pointer[1..].Split('/'))
        {
            var segmentBuilder = new StringBuilder();
            for (var index = 0; index < encodedSegment.Length; index++)
            {
                var character = encodedSegment[index];
                if (character != '~')
                {
                    segmentBuilder.Append(character);
                    continue;
                }

                if (++index >= encodedSegment.Length || encodedSegment[index] is not ('0' or '1'))
                {
                    normalized = null;
                    return false;
                }

                segmentBuilder.Append(encodedSegment[index] == '0' ? '~' : '/');
            }

            builder.Append('/').Append(EscapePointerSegment(segmentBuilder.ToString()));
        }

        normalized = builder.ToString();
        return true;
    }

    public static bool TryResolveReference(Uri baseUri, string value, out Uri? resolved) =>
        TryResolveUri(baseUri, value, SchemaValidationLimits.MaximumReferenceScalars, allowFragment: true, out resolved);

    public static bool TryResolveSchemaId(Uri baseUri, string value, out Uri? resolved) =>
        TryResolveUri(baseUri, value, SchemaValidationLimits.MaximumSchemaIdScalars, allowFragment: false, out resolved) &&
        string.IsNullOrEmpty(resolved!.UserInfo);

    static bool ContainsUnsafeIdentifierCharacter(string value)
    {
        foreach (var character in value)
        {
            if (char.IsControl(character) ||
                char.IsWhiteSpace(character) ||
                character > '\u007e' ||
                character is '\u061c' or '\u200e' or '\u200f' or
                    (>= '\u202a' and <= '\u202e') or
                    (>= '\u2066' and <= '\u2069'))
            {
                return true;
            }
        }

        return false;
    }

    static string EscapePointerSegment(string segment) =>
        segment.Replace("~", "~0", StringComparison.Ordinal).Replace("/", "~1", StringComparison.Ordinal);

    static bool IsAnchorStart(char value) => value is (>= 'A' and <= 'Z') or (>= 'a' and <= 'z') or '_';

    static bool TryReadReferencePointer(Uri referenceUri, Uri resourceUri, out string? pointer)
    {
        var succeeded = TryReadSchemaLocation(referenceUri, out var referencedResource, out pointer) &&
                        string.Equals(referencedResource, resourceUri.AbsoluteUri, StringComparison.Ordinal);
        if (!succeeded)
        {
            pointer = null;
        }

        return succeeded;
    }

    static bool TryResolveUri(Uri baseUri, string value, int maximumScalars, bool allowFragment, out Uri? resolved)
    {
        resolved = null;
        if (value.Length > maximumScalars * 2 ||
            value.EnumerateRunes().Count() > maximumScalars ||
            ContainsUnsafeIdentifierCharacter(value) ||
            !Uri.TryCreate(value, UriKind.RelativeOrAbsolute, out var parsed))
        {
            return false;
        }

        try
        {
            resolved = parsed.IsAbsoluteUri ? parsed : new(baseUri, parsed);
        }
        catch (UriFormatException)
        {
            return false;
        }

        return resolved.IsAbsoluteUri &&
               string.Equals(resolved.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
               string.IsNullOrEmpty(resolved.Query) &&
               string.IsNullOrEmpty(resolved.UserInfo) &&
               (allowFragment || string.IsNullOrEmpty(resolved.Fragment)) &&
               resolved.AbsoluteUri.EnumerateRunes().Count() <= maximumScalars;
    }
}

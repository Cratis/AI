// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Cryptography;
using System.Text;

namespace Planner.Alerts;

/// <summary>
/// The identity of an alert - derived from the source and the fingerprint so a condition that keeps
/// being reported keeps landing on the same alert rather than creating a new one every delivery.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AlertId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The value representing an unset alert identity.
    /// </summary>
    public static readonly AlertId NotSet = new(string.Empty);

    const int MaximumLength = 160;

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AlertId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AlertId(string value) => new(value);

    /// <summary>
    /// Creates an <see cref="AlertId"/> from the source and fingerprint of an alert. The identity is
    /// readable (<c>studio-production-pod-loki-0-crashloopbackoff</c>) rather than opaque, because
    /// it is the event source id every event about the alert is keyed by.
    /// </summary>
    /// <param name="source">The system the alert came from.</param>
    /// <param name="fingerprint">The sending system's stable key for the condition.</param>
    /// <returns>The predictable identity for the alert.</returns>
    public static AlertId From(AlertSource source, AlertFingerprint fingerprint)
    {
        var slug = Slugify($"{source.Value}-{fingerprint.Value}");

        // A fingerprint carrying, say, a full stack trace would otherwise produce an unusable key.
        // Truncating alone could collide two long conditions sharing a prefix, so what is dropped is
        // replaced by a hash of the whole thing.
        if (slug.Length > MaximumLength)
        {
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(slug)))[..8].ToLowerInvariant();
            slug = $"{slug[..(MaximumLength - hash.Length - 1)]}-{hash}";
        }

        return new(slug);
    }

    static string Slugify(string value)
    {
        var builder = new StringBuilder(value.Length);
        foreach (var character in value.ToLowerInvariant())
        {
            if (char.IsAsciiLetterOrDigit(character))
            {
                builder.Append(character);
            }
            else if (builder.Length > 0 && builder[^1] != '-')
            {
                builder.Append('-');
            }
        }

        return builder.ToString().Trim('-');
    }
}

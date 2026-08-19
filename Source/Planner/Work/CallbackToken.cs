// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Cryptography;
using Cratis.Chronicle.Compliance.GDPR;

namespace Planner.Work;

/// <summary>
/// A one-time bearer credential a worker container authenticates its callbacks with - handed to the
/// container as an environment variable and never persisted to the event log. Marked
/// <see cref="PIIAttribute"/> for the rare case a value of it does end up on a projected record, so
/// Chronicle still encrypts it at rest.
/// </summary>
/// <param name="Value">The underlying value.</param>
[PII]
public record CallbackToken(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset callback token.
    /// </summary>
    public static readonly CallbackToken NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="CallbackToken"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator CallbackToken(string value) => new(value);

    /// <summary>
    /// Creates a new, cryptographically random callback token.
    /// </summary>
    /// <returns>A new <see cref="CallbackToken"/>.</returns>
    public static CallbackToken New() => new(Convert.ToHexString(RandomNumberGenerator.GetBytes(32)));
}

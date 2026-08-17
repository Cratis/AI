// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Compliance.GDPR;

namespace Planner.Work;

/// <summary>
/// The bearer credential a worker container authenticates its callbacks with - a cryptographically
/// random value issued for one single unit of work when it is dispatched, known only to the Planner
/// and that one container. Marked <see cref="PIIAttribute"/> so Chronicle encrypts it at rest, keyed
/// by the work it belongs to (the event source id already resolves as the subject) - the same
/// treatment the Claude account token gets, for the same reason: it is a credential, and the event
/// log keeps what it is handed forever.
/// </summary>
/// <param name="Value">The underlying value.</param>
[PII]
public record WorkToken(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset token. It never authenticates anything - a caller presenting
    /// it, and a unit of work that was never issued one, are both rejected.
    /// </summary>
    public static readonly WorkToken NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="WorkToken"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator WorkToken(string value) => new(value);
}

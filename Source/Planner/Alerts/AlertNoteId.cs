// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// The identity of a single note recorded against an alert.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AlertNoteId(Guid Value) : ConceptAs<Guid>(Value)
{
    /// <summary>
    /// The value representing an unset note identity.
    /// </summary>
    public static readonly AlertNoteId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="AlertNoteId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AlertNoteId(Guid value) => new(value);

    /// <summary>
    /// Creates a new <see cref="AlertNoteId"/>.
    /// </summary>
    /// <returns>A new identity.</returns>
    public static AlertNoteId New() => new(Guid.NewGuid());
}

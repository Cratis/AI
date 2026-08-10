// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// Free-form text recorded against an alert - what an agent found, what a person added on the way to
/// a fix, or how it was finally resolved.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AlertNote(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset note.
    /// </summary>
    public static readonly AlertNote NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AlertNote"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AlertNote(string value) => new(value);
}

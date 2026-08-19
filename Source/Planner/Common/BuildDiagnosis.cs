// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// What the Planner's language model made of a failing build - a short, free-form diagnosis.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record BuildDiagnosis(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no diagnosis.
    /// </summary>
    public static readonly BuildDiagnosis NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="BuildDiagnosis"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator BuildDiagnosis(string value) => new(value);
}

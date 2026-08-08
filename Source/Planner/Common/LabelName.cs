// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The name of a label on an issue, as classified on GitHub.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record LabelName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="LabelName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator LabelName(string value) => new(value);
}

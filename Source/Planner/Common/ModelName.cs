// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The name of a language model used for agent work, such as <c>opus</c> or <c>sonnet</c>.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record ModelName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset model name.
    /// </summary>
    public static readonly ModelName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="ModelName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator ModelName(string value) => new(value);
}

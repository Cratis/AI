// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// Extra instructions a human attaches to an issue or a group - sent along with the prompt the
/// Claude agent gets when working on it.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record WorkPrompt(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no extra instructions.
    /// </summary>
    public static readonly WorkPrompt NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="WorkPrompt"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator WorkPrompt(string value) => new(value);
}

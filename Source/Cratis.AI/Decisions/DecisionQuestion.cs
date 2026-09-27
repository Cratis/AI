// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// The question the choices answer - "what kind of issue is this?". Optional, but an engine weighs
/// choices far better when it is told what they are choices between.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record DecisionQuestion(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no explicit question.
    /// </summary>
    public static readonly DecisionQuestion NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="DecisionQuestion"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DecisionQuestion(string value) => new(value);
}

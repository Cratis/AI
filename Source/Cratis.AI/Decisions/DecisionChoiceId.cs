// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// One of the finite outcomes a caller asks a decision provider to weigh. Deliberately an opaque
/// caller-supplied string: the vocabulary belongs to the workflow asking the question, never to the
/// provider answering it, so no provider can grow an opinion about what "implement" means.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record DecisionChoiceId(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no choice.
    /// </summary>
    public static readonly DecisionChoiceId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="DecisionChoiceId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DecisionChoiceId(string value) => new(value);
}

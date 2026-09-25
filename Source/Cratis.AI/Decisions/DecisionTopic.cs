// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// What a decision is about, from the calling workflow's point of view - "issue type", "semantic
/// version", "labels". Opaque to the package; it exists so usage can be broken down the same way a
/// language model's usage is broken down by purpose.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record DecisionTopic(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing a decision whose caller named no topic.
    /// </summary>
    public static readonly DecisionTopic NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="DecisionTopic"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DecisionTopic(string value) => new(value);
}

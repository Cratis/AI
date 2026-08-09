// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// A number of language model tokens.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record TokenCount(long Value) : ConceptAs<long>(Value)
{
    /// <summary>
    /// The value representing an unknown token count.
    /// </summary>
    public static readonly TokenCount NotSet = new(0L);

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="TokenCount"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator TokenCount(long value) => new(value);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The identity of an issue comment - GitHub's comment id.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record CommentId(long Value) : ConceptAs<long>(Value)
{
    /// <summary>
    /// The value representing an unset comment identity.
    /// </summary>
    public static readonly CommentId NotSet = new(0L);

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="CommentId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator CommentId(long value) => new(value);
}

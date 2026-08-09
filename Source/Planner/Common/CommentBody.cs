// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The markdown body of an issue comment.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record CommentBody(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an empty comment body.
    /// </summary>
    public static readonly CommentBody NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="CommentBody"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator CommentBody(string value) => new(value);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The identity of a team member who can be granted or denied use of a configured AI provider. Kept
/// as an opaque value here - whatever directory names, displays, and pictures them is a concern
/// outside this library.
/// </summary>
/// <param name="Value">The underlying identity value.</param>
public record TeamMemberId(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset team member identity.
    /// </summary>
    public static readonly TeamMemberId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="TeamMemberId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator TeamMemberId(string value) => new(value);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The stable identity of a team member who may be allowed to use a configured AI provider -
/// whatever identifier the consuming application already uses for that person (a login, an email,
/// or an internal user id). The package does not resolve this value against a directory or carry a
/// display name or avatar for it; it is an opaque label for comparing the identity of whoever
/// started a unit of work against a provider's selection.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record TeamMemberId(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="TeamMemberId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator TeamMemberId(string value) => new(value);
}

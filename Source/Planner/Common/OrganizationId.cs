// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The identity of a GitHub organization - the lowercased organization name.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record OrganizationId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The value representing an unset organization identity.
    /// </summary>
    public static readonly OrganizationId NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="OrganizationId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator OrganizationId(string value) => new(value);

    /// <summary>
    /// Creates an <see cref="OrganizationId"/> from an organization name.
    /// </summary>
    /// <param name="name">The organization name.</param>
    /// <returns>The predictable identity for the organization.</returns>
    public static OrganizationId From(OrganizationName name) => new(name.Value.ToLowerInvariant());
}

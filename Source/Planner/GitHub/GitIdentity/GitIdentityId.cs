// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.GitIdentity;

/// <summary>
/// The identity of the git identity setting - fixed, since there is exactly one per deployment.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record GitIdentityId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The single, fixed git identity stream every deployment shares.
    /// </summary>
    public static readonly GitIdentityId Default = new("git-identity");

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="GitIdentityId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator GitIdentityId(string value) => new(value);
}

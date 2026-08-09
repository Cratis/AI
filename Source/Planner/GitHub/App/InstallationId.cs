// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.App;

/// <summary>
/// The identity of a GitHub App installation - GitHub's own numeric installation id.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record InstallationId(long Value) : EventSourceId<long>(Value)
{
    /// <summary>
    /// The value representing an unset installation identity.
    /// </summary>
    public static readonly InstallationId NotSet = new(0L);

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="InstallationId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator InstallationId(long value) => new(value);
}

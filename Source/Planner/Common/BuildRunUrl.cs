// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The html URL of a GitHub Actions workflow run.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record BuildRunUrl(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unknown run.
    /// </summary>
    public static readonly BuildRunUrl NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="BuildRunUrl"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator BuildRunUrl(string value) => new(value);
}

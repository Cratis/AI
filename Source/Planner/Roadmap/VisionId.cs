// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Roadmap;

/// <summary>
/// The identity of the vision document - fixed, since there is exactly one per deployment.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record VisionId(string Value) : EventSourceId<string>(Value)
{
    /// <summary>
    /// The single, fixed vision stream every deployment shares.
    /// </summary>
    public static readonly VisionId Default = new("vision");

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="VisionId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator VisionId(string value) => new(value);
}

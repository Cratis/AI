// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The markdown content of the Planner's vision document - where the team is going, maintained by
/// hand and given to agents as context.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record VisionContent(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no vision written yet.
    /// </summary>
    public static readonly VisionContent NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="VisionContent"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator VisionContent(string value) => new(value);
}

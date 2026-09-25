// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.Usage;

/// <summary>
/// The identity of one recorded call to a decision engine.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record DecisionUsageId(Guid Value) : EventSourceId<Guid>(Value)
{
    /// <summary>
    /// The value representing no usage record.
    /// </summary>
    public static readonly DecisionUsageId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="DecisionUsageId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DecisionUsageId(Guid value) => new(value);

    /// <summary>
    /// Creates a new unique usage identity.
    /// </summary>
    /// <returns>A new <see cref="DecisionUsageId"/>.</returns>
    public static DecisionUsageId New() => new(Guid.NewGuid());
}

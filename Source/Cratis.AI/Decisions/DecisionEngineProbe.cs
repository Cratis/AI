// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// The result of checking whether a decision engine can answer.
/// </summary>
/// <param name="IsReachable">Whether the engine answered and is ready.</param>
/// <param name="Detail">What was found, in words a person configuring the engine can act on.</param>
public record DecisionEngineProbe(bool IsReachable, string Detail)
{
    /// <summary>
    /// Creates a probe result for an engine that is ready.
    /// </summary>
    /// <param name="detail">What was found.</param>
    /// <returns>The <see cref="DecisionEngineProbe"/>.</returns>
    public static DecisionEngineProbe Ready(string detail) => new(true, detail);

    /// <summary>
    /// Creates a probe result for an engine that could not answer.
    /// </summary>
    /// <param name="detail">Why not.</param>
    /// <returns>The <see cref="DecisionEngineProbe"/>.</returns>
    public static DecisionEngineProbe Unreachable(string detail) => new(false, detail);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents;

/// <summary>
/// How much reasoning effort an agent's session runs with - carried into <see cref="AIAgentCausation"/>'s
/// extra properties so dispatch causation records what was actually asked for. What "effort" means
/// is entirely vendor-specific - each provider client translates its own way (Anthropic's
/// extended-thinking token budget, OpenAI/Azure's <c>reasoning_effort</c>), so this enum carries no
/// vendor semantics of its own. Ported from Direct's <c>Agents.Effort</c> (plan Section 5.2 step 1).
/// </summary>
public enum Effort
{
    /// <summary>
    /// The lightest tier - no extended reasoning, fastest and cheapest.
    /// </summary>
    Low = 0,

    /// <summary>
    /// A moderate amount of reasoning.
    /// </summary>
    Medium = 1,

    /// <summary>
    /// A generous amount of reasoning - a common default.
    /// </summary>
    High = 2,

    /// <summary>
    /// The heaviest tier - maximum reasoning, for the hardest or highest-stakes jobs.
    /// </summary>
    ExtraHigh = 3,
}

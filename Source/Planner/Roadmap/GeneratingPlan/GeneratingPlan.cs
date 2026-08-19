// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Roadmap.GeneratingPlan;

/// <summary>
/// Command for recording a generated plan - executed by the plan generation reactor once the
/// language model has produced one.
/// </summary>
/// <param name="Plan">The identity of the plan.</param>
/// <param name="Content">The markdown content of the plan.</param>
[Command]
public record GeneratePlan(PlanId Plan, PlanContent Content)
{
    /// <summary>
    /// Handles the command by appending a <see cref="PlanGenerated"/> event to the plan's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public PlanGenerated Handle() => new(Content);
}

/// <summary>
/// Event raised when a plan has been generated.
/// </summary>
/// <param name="Content">The markdown content of the plan.</param>
[EventType]
public record PlanGenerated(PlanContent Content);

/// <summary>
/// Command for recording that generating a plan failed.
/// </summary>
/// <param name="Plan">The identity of the plan.</param>
/// <param name="Reason">Why it failed.</param>
[Command]
public record FailPlanGeneration(PlanId Plan, string Reason)
{
    /// <summary>
    /// Handles the command by appending a <see cref="PlanGenerationFailed"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public PlanGenerationFailed Handle() => new(Reason);
}

/// <summary>
/// Event raised when generating a plan failed - most commonly, no language model is configured.
/// </summary>
/// <param name="Reason">Why it failed.</param>
[EventType]
public record PlanGenerationFailed(string Reason);

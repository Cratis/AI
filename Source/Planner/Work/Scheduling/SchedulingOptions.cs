// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Accounts;

namespace Planner.Work.Scheduling;

/// <summary>
/// Represents the boundaries the scheduler respects when dispatching work, bound from the
/// <c>Planner:Scheduling</c> configuration section. The session limits mirror what the regular
/// Claude plans typically allow per five-hour window and per week.
/// </summary>
public class SchedulingOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:Scheduling";

    /// <summary>
    /// Gets or sets how many units of work may run concurrently on one account.
    /// </summary>
    public int MaxConcurrentWorkPerAccount { get; set; } = 1;

    /// <summary>
    /// Gets or sets the model used for implementation work when neither the work nor an
    /// investigation suggested one.
    /// </summary>
    public string DefaultModel { get; set; } = "sonnet";

    /// <summary>
    /// Gets or sets the model used for investigations.
    /// </summary>
    public string InvestigationModel { get; set; } = "opus";

    /// <summary>
    /// Gets or sets the per-plan usage limits.
    /// </summary>
    public IDictionary<ClaudePlan, PlanLimits> Limits { get; set; } = new Dictionary<ClaudePlan, PlanLimits>()
    {
        [ClaudePlan.Pro] = new() { SessionsPerFiveHours = 1, SessionsPerWeek = 40 },
        [ClaudePlan.Max5x] = new() { SessionsPerFiveHours = 3, SessionsPerWeek = 120 },
        [ClaudePlan.Max20x] = new() { SessionsPerFiveHours = 6, SessionsPerWeek = 240 }
    };

    /// <summary>
    /// Gets the limits for a plan, falling back to the most conservative limits when unconfigured.
    /// </summary>
    /// <param name="plan">The plan to get limits for.</param>
    /// <returns>The <see cref="PlanLimits"/> for the plan.</returns>
    public PlanLimits LimitsFor(ClaudePlan plan) =>
        Limits.TryGetValue(plan, out var limits) ? limits : new PlanLimits { SessionsPerFiveHours = 1, SessionsPerWeek = 40 };
}

/// <summary>
/// Represents the usage limits of a Claude plan.
/// </summary>
public class PlanLimits
{
    /// <summary>
    /// Gets or sets how many work sessions may start within a rolling five-hour window.
    /// </summary>
    public int SessionsPerFiveHours { get; set; }

    /// <summary>
    /// Gets or sets how many work sessions may start within a rolling week.
    /// </summary>
    public int SessionsPerWeek { get; set; }
}

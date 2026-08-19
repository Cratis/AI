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
    /// Gets or sets how long a unit of work may stay running before the scheduler treats its worker
    /// as dead and fails it. This is the only way a container that dies without reporting - an OOM
    /// kill, a node eviction, a crash - ever releases the concurrency slot it holds: nothing else
    /// ever moves a stuck item out of the running state, and <see cref="MaxConcurrentWorkPerAccount"/>
    /// defaults to <c>1</c>, so one such item wedges its account indefinitely. The worker runtime
    /// exposes no way to ask whether a container is still alive, so this sweep can only go on
    /// duration - which makes the default deliberately generous: an agent legitimately running for
    /// hours on a hard issue is normal, and failing a container that is still working is worse than
    /// leaving a dead one queued a while longer. <see cref="TimeSpan.Zero"/> disables the sweep
    /// entirely.
    /// </summary>
    public TimeSpan MaxRunningDuration { get; set; } = TimeSpan.FromHours(24);

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

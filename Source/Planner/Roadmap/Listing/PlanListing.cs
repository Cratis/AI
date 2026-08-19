// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Roadmap.GeneratingPlan;
using Planner.Roadmap.RequestingPlan;

namespace Planner.Roadmap.Listing;

/// <summary>
/// Read model for a plan covering a set of selected issues.
/// </summary>
/// <param name="Id">The plan identity.</param>
/// <param name="Issues">The identities of the issues the plan covers.</param>
/// <param name="Instructions">Extra instructions the plan was requested with.</param>
/// <param name="RequestedBy">The login of the user that requested the plan.</param>
/// <param name="RequestedAt">When the plan was requested.</param>
/// <param name="Status">Where the plan stands.</param>
/// <param name="Content">The markdown content of the plan - empty until generated.</param>
/// <param name="FailureReason">Why generation failed - empty unless <see cref="Status"/> is <see cref="PlanStatus.Failed"/>.</param>
[ReadModel]
[FromEvent<PlanRequested>]
public record Plan(
    PlanId Id,
    IEnumerable<IssueId> Issues,
    PlanInstructions Instructions,
    UserName RequestedBy,
    [SetFromContext<PlanRequested>(nameof(EventContext.Occurred))]
    DateTimeOffset? RequestedAt = null,
    [SetValue<PlanRequested>(PlanStatus.Generating)]
    [SetValue<PlanGenerated>(PlanStatus.Ready)]
    [SetValue<PlanGenerationFailed>(PlanStatus.Failed)]
    PlanStatus Status = PlanStatus.Generating,
    [SetFrom<PlanGenerated>(nameof(PlanGenerated.Content))]
    PlanContent? Content = null,
    [SetFrom<PlanGenerationFailed>(nameof(PlanGenerationFailed.Reason))]
    string FailureReason = "")
{
    /// <summary>
    /// Observes every plan.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the plans.</param>
    /// <returns>An observable of every plan.</returns>
    public static ISubject<IEnumerable<Plan>> AllPlans(IMongoCollection<Plan> collection) =>
        collection.Observe();
}

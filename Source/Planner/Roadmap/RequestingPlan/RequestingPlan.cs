// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Identity;

namespace Planner.Roadmap.RequestingPlan;

/// <summary>
/// Command for requesting a plan covering a set of selected issues - ordering, grouping,
/// dependencies, suggested priorities and models, open questions, produced by the Planner's own
/// language model rather than a worker container (this is reasoning about the issues, not
/// implementation work).
/// </summary>
/// <param name="Issues">The identities of the issues to plan across.</param>
/// <param name="Instructions">Extra, free-form instructions for the plan - optional.</param>
[Command]
public record RequestPlan(IEnumerable<IssueId> Issues, PlanInstructions? Instructions = null)
{
    /// <summary>
    /// Handles the command by opening a new plan stream and appending a <see cref="PlanRequested"/> event.
    /// </summary>
    /// <param name="currentUser">The <see cref="ICurrentUser"/> requesting the plan, when there is one.</param>
    /// <returns>A tuple of the plan identity (event source) and the event.</returns>
    public (PlanId, PlanRequested) Handle(ICurrentUser currentUser) =>
        (PlanId.New(), new(Issues, Instructions ?? PlanInstructions.NotSet, currentUser.GetUserName()));
}

/// <summary>
/// Represents the validator for the <see cref="RequestPlan"/> command.
/// </summary>
public class RequestPlanValidator : CommandValidator<RequestPlan>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RequestPlanValidator"/> class.
    /// </summary>
    public RequestPlanValidator() => RuleFor(_ => _.Issues).NotEmpty().WithMessage("Select at least one issue to plan");
}

/// <summary>
/// Event raised when a plan has been requested - the plan generation reactor picks it up from here.
/// </summary>
/// <param name="Issues">The identities of the issues to plan across.</param>
/// <param name="Instructions">Extra, free-form instructions for the plan.</param>
/// <param name="RequestedBy">The login of the user that requested the plan - <see cref="UserName.NotSet"/> for automation.</param>
[EventType]
public record PlanRequested(IEnumerable<IssueId> Issues, PlanInstructions Instructions, UserName RequestedBy);

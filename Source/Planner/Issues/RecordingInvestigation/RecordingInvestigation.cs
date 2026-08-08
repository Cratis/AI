// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.RecordingInvestigation;

/// <summary>
/// Command for recording the outcome of an investigation of an issue - the plan for how it can be
/// implemented and the model suggested for doing the work.
/// </summary>
/// <param name="Issue">The identity of the issue.</param>
/// <param name="Summary">The markdown summary of the investigation.</param>
/// <param name="SuggestedModel">The model the investigation suggests for implementing the issue.</param>
[Command]
public record RecordInvestigation(IssueId Issue, InvestigationSummary Summary, ModelName SuggestedModel)
{
    /// <summary>
    /// Handles the command by appending an <see cref="IssueInvestigated"/> event to the issue's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public IssueInvestigated Handle() => new(Summary, SuggestedModel);
}

/// <summary>
/// Represents the validator for the <see cref="RecordInvestigation"/> command.
/// </summary>
public class RecordInvestigationValidator : CommandValidator<RecordInvestigation>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RecordInvestigationValidator"/> class.
    /// </summary>
    public RecordInvestigationValidator() => RuleFor(_ => _.Summary).NotEmpty().WithMessage("An investigation summary is required");
}

/// <summary>
/// Event raised when an issue has been investigated by an agent - it holds the implementation plan
/// and which model the investigation suggests for doing the work, used when scheduling.
/// </summary>
/// <param name="Summary">The markdown summary of the investigation.</param>
/// <param name="SuggestedModel">The model suggested for implementing the issue.</param>
[EventType]
public record IssueInvestigated(InvestigationSummary Summary, ModelName SuggestedModel);

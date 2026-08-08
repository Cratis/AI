// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Issues;

namespace Planner.Work.CompletingInvestigation;

/// <summary>
/// Command for recording that a unit of investigation work completed - executed when the worker
/// container reports back with its findings.
/// </summary>
/// <param name="Work">The identity of the work.</param>
/// <param name="Findings">The markdown findings of the investigation - the plan for how the issues can be implemented or fixed.</param>
/// <param name="SuggestedModel">The model the investigation suggests for implementing the issues.</param>
[Command]
public record CompleteInvestigation(WorkId Work, InvestigationSummary Findings, ModelName SuggestedModel)
{
    /// <summary>
    /// Handles the command by appending an <see cref="InvestigationCompleted"/> event to the work's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public InvestigationCompleted Handle() => new(Findings, SuggestedModel);
}

/// <summary>
/// Represents the validator for the <see cref="CompleteInvestigation"/> command.
/// </summary>
public class CompleteInvestigationValidator : CommandValidator<CompleteInvestigation>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="CompleteInvestigationValidator"/> class.
    /// </summary>
    public CompleteInvestigationValidator() => RuleFor(_ => _.Findings).NotEmpty().WithMessage("Investigation findings are required");
}

/// <summary>
/// Event raised when a unit of investigation work completed - the findings flow onto the covered
/// issues and are reported back to the original GitHub issues as comments.
/// </summary>
/// <param name="Findings">The markdown findings of the investigation.</param>
/// <param name="SuggestedModel">The model the investigation suggests for implementing the issues.</param>
[EventType]
public record InvestigationCompleted(InvestigationSummary Findings, ModelName SuggestedModel);

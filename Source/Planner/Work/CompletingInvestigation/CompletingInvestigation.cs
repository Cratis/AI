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
/// <param name="InputTokens">The input tokens the session consumed - optional.</param>
/// <param name="OutputTokens">The output tokens the session produced - optional.</param>
/// <param name="Cost">The cost of the session in USD as the Claude CLI reported it - optional.</param>
/// <param name="DurationMs">How long the session ran, in milliseconds - optional.</param>
[Command]
public record CompleteInvestigation(
    WorkId Work,
    InvestigationSummary Findings,
    ModelName SuggestedModel,
    TokenCount? InputTokens = null,
    TokenCount? OutputTokens = null,
    UsageCost? Cost = null,
    long DurationMs = 0)
{
    /// <summary>
    /// Handles the command by appending an <see cref="InvestigationCompleted"/> event to the work's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public InvestigationCompleted Handle() => new(
        Findings,
        SuggestedModel,
        InputTokens ?? TokenCount.NotSet,
        OutputTokens ?? TokenCount.NotSet,
        Cost ?? UsageCost.NotSet,
        DurationMs);
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
/// issues and are reported back to the original GitHub issues as comments; the session's usage
/// travels along for the account usage statistics.
/// </summary>
/// <param name="Findings">The markdown findings of the investigation.</param>
/// <param name="SuggestedModel">The model the investigation suggests for implementing the issues.</param>
/// <param name="InputTokens">The input tokens the session consumed.</param>
/// <param name="OutputTokens">The output tokens the session produced.</param>
/// <param name="Cost">The cost of the session in USD as the Claude CLI reported it.</param>
/// <param name="DurationMs">How long the session ran, in milliseconds.</param>
[EventType]
public record InvestigationCompleted(
    InvestigationSummary Findings,
    ModelName SuggestedModel,
    TokenCount InputTokens,
    TokenCount OutputTokens,
    UsageCost Cost,
    long DurationMs);

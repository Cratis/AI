// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Issues.Registration;

namespace Planner.Issues.Triaging;

/// <summary>
/// Builds the prompt the triage reactor asks the language model to classify a newly registered
/// issue with.
/// </summary>
public static class TriagePrompts
{
    const string ResponseShape =
        """
        Classify it and respond with ONLY a single JSON object, no other text, matching exactly this shape:
        {
          "kind": "bug" | "feature" | "question" | "docs" | "chore" | "support",
          "feasibility": "agentCanDo" | "needsHumanDecision" | "needsMoreInformation" | "notActionable" | "duplicate",
          "priority": "critical" | "high" | "normal" | "low" | "notSet",
          "labels": ["short-label-name", ...],
          "area": "short free-form area name, e.g. 'Chronicle kernel'",
          "model": "opus" | "sonnet" | "haiku"
        }

        Use "agentCanDo" only when the report is specific enough that a coding agent could plan and
        implement it without a person deciding anything first. Use "notSet" for priority when you
        have no real signal either way - do not default to "normal".
        """;

    /// <summary>
    /// Builds the classification prompt for an issue.
    /// </summary>
    /// <param name="event">The <see cref="IssueRegistered"/> event describing the issue.</param>
    /// <returns>The prompt.</returns>
    public static string Classify(IssueRegistered @event) =>
        $"""
        You are triaging a newly opened GitHub issue in {@event.Owner.Value}/{@event.Repository.Value}.

        Title: {@event.Title.Value}
        Body:
        {(string.IsNullOrWhiteSpace(@event.Body.Value) ? "(no body)" : @event.Body.Value)}


        """ + ResponseShape;
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Roadmap.GeneratingPlan;

/// <summary>
/// Builds the prompt the plan generation reactor asks the language model to plan a set of selected
/// issues with.
/// </summary>
public static class PlanPrompts
{
    /// <summary>
    /// Builds the planning prompt for a set of issues.
    /// </summary>
    /// <param name="issues">The issues to plan across.</param>
    /// <param name="instructions">Extra instructions given alongside the issues.</param>
    /// <returns>The prompt.</returns>
    public static string Build(IReadOnlyList<ListedIssue> issues, string instructions)
    {
        var listed = string.Join(
            "\n\n",
            issues.Select(issue =>
                $"### {issue.Owner.Value}/{issue.Repository.Value}#{issue.Number.Value}: {issue.Title.Value}\n" +
                (string.IsNullOrWhiteSpace(issue.Body?.Value) ? "(no body)" : issue.Body.Value)));

        var extra = string.IsNullOrWhiteSpace(instructions) ? string.Empty : $"\nExtra instructions from whoever requested this plan:\n{instructions}\n";

        return $"""
            You are planning a set of GitHub issues together, across one or more repositories.

            {listed}
            {extra}
            Produce a plan in markdown covering all of them together: a suggested order, how they
            group into units of work, dependencies between repositories, a suggested priority and
            model for each (opus for hard/risky work, sonnet for typical implementation, haiku for
            trivial changes), and any open questions a person should answer before work starts.

            Respond with the plan in markdown, and nothing else - no preamble, no code fences around
            the whole response.
            """;
    }
}

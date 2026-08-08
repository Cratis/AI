// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using Planner.Issues;
using Planner.Work.Listing;
using ListedIssue = Planner.Issues.Listing.Issue;

namespace Planner.Work.Workers;

/// <summary>
/// Builds the prompts handed to the Claude CLI in a worker container.
/// </summary>
public static class WorkerPrompts
{
    /// <summary>
    /// The marker line an investigation ends its output with to suggest the implementation model.
    /// </summary>
    public const string SuggestedModelMarker = "SUGGESTED-MODEL:";

    /// <summary>
    /// Builds the prompt for a unit of work.
    /// </summary>
    /// <param name="work">The work the prompt is for.</param>
    /// <param name="issues">The issues the work covers.</param>
    /// <returns>The prompt.</returns>
    public static string Build(WorkItem work, IReadOnlyList<ListedIssue> issues) =>
        work.Purpose == WorkPurpose.Investigation ? BuildInvestigation(issues) : BuildImplementation(issues);

    static string BuildImplementation(IReadOnlyList<ListedIssue> issues)
    {
        var prompt = new StringBuilder()
            .AppendLine("You are implementing GitHub issues in the repository checked out at your working directory.")
            .AppendLine()
            .AppendLine("Issues to implement:");
        AppendIssues(prompt, issues);
        prompt
            .AppendLine()
            .AppendLine("Instructions:")
            .AppendLine("- Use `gh issue view <number> --repo <owner>/<repo>` to read the full details and comments of each issue.")
            .AppendLine("- Follow the conventions of the repository. Build and run the tests; everything must be green before you finish.")
            .AppendLine("- Commit in logical units with clear messages and push your branch.")
            .AppendLine("- Open a single pull request with `gh pr create` covering the work, referencing each issue so it closes on merge.")
            .AppendLine("- If you come across bugs or limitations in upstream Cratis repositories while working, report them upstream with `gh issue create --repo <upstream>`.")
            .AppendLine("- End your final message with the URL of the pull request you created.");
        return prompt.ToString();
    }

    static string BuildInvestigation(IReadOnlyList<ListedIssue> issues)
    {
        var prompt = new StringBuilder()
            .AppendLine("You are investigating GitHub issues for the repository checked out at your working directory. Do not change any code.")
            .AppendLine()
            .AppendLine("Issues to investigate:");
        AppendIssues(prompt, issues);
        prompt
            .AppendLine()
            .AppendLine("Instructions:")
            .AppendLine("- Use `gh issue view <number> --repo <owner>/<repo>` to read the full details and comments of each issue.")
            .AppendLine("- Study the codebase and produce a concrete plan for how each issue can be implemented or fixed.")
            .AppendLine("- If you cannot determine a confident plan, ask the team for more input by commenting on the issue with `gh issue comment`.")
            .AppendLine("- Suggest which Claude model should implement the work: `haiku` for trivial changes, `sonnet` for regular work, `opus` for hard or risky work.")
            .AppendLine($"- End your final message with a line `{SuggestedModelMarker} <model>` followed by the plan in markdown.");
        return prompt.ToString();
    }

    static void AppendIssues(StringBuilder prompt, IReadOnlyList<ListedIssue> issues)
    {
        foreach (var issue in issues)
        {
            prompt.AppendLine($"- {issue.Owner.Value}/{issue.Repository.Value}#{issue.Number.Value}: {issue.Title.Value}");
            if (issue.Investigation?.Equals(InvestigationSummary.NotSet) == false)
            {
                prompt.AppendLine($"  An earlier investigation produced this plan:\n  {issue.Investigation.Value.ReplaceLineEndings("\n  ")}");
            }
        }
    }
}

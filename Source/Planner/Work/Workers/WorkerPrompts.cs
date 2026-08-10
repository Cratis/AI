// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using Planner.Issues;
using Planner.Operations;
using Planner.Work.Listing;
using ListedAlert = Planner.Alerts.Listing.Alert;
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
    /// The marker line an alert investigation ends its output with to say whether it resolved the alert.
    /// </summary>
    public const string AlertOutcomeMarker = "ALERT-OUTCOME:";

    /// <summary>
    /// The value of <see cref="AlertOutcomeMarker"/> meaning the agent resolved the alert.
    /// </summary>
    public const string AlertResolvedOutcome = "resolved";

    /// <summary>
    /// The value of <see cref="AlertOutcomeMarker"/> meaning a person has to take the alert over.
    /// </summary>
    public const string AlertNeedsAttentionOutcome = "needs-attention";

    /// <summary>
    /// Builds the prompt for a unit of work.
    /// </summary>
    /// <param name="work">The work the prompt is for.</param>
    /// <param name="issues">The issues the work covers.</param>
    /// <param name="groupPrompt">The group's extra instructions, when the work covers a group that has them.</param>
    /// <returns>The prompt.</returns>
    public static string Build(WorkItem work, IReadOnlyList<ListedIssue> issues, WorkPrompt? groupPrompt = null)
    {
        var prompt = work.Purpose == WorkPurpose.Investigation ? BuildInvestigation(issues) : BuildImplementation(issues);
        if (groupPrompt?.Equals(WorkPrompt.NotSet) == false)
        {
            prompt = $"{prompt}\nAdditional instructions for this group of issues:\n{groupPrompt.Value}\n";
        }

        return prompt;
    }

    /// <summary>
    /// Builds the prompt for ad-hoc work over one or more repositories.
    /// </summary>
    /// <param name="work">The ad-hoc work the prompt is for.</param>
    /// <returns>The prompt.</returns>
    public static string BuildAdHoc(WorkItem work) => new StringBuilder()
        .AppendLine("You are doing ad-hoc work. The repositories to work with are cloned under your working directory - one folder per repository.")
        .AppendLine()
        .AppendLine("Task:")
        .AppendLine(work.Prompt?.Value ?? string.Empty)
        .AppendLine()
        .AppendLine("Instructions:")
        .AppendLine("- Follow the conventions and agent instructions of each repository. Keep your main context lean: delegate large exploration and reading to subagents and keep the main thread for deciding, editing and verifying.")
        .AppendLine("- Verification has teeth: confirm every claim of done or fixed against a fresh signal - a build, a test run, observed behavior - never your own assessment. Build and run the tests of everything you touch; it must be green before you finish.")
        .AppendLine("- Commit in logical units with clear messages. Push a branch and open a pull request with `gh pr create` for each repository you changed, describing what you verified and naming anything you did not.")
        .AppendLine("- If you come across bugs or limitations in upstream Cratis repositories while working, report them upstream with `gh issue create --repo <upstream>`.")
        .AppendLine("- End your final message with a summary and the URLs of any pull requests you created.")
        .ToString();

    /// <summary>
    /// Builds the prompt for investigating an alert from a running system.
    /// </summary>
    /// <param name="alert">The alert to investigate.</param>
    /// <param name="operations">The operational access the agent has been given.</param>
    /// <returns>The prompt.</returns>
    /// <remarks>
    /// The agent is told what it can reach rather than left to discover it, because an agent that
    /// believes it has a cluster it cannot reach spends its session failing at <c>kubectl</c> instead
    /// of reading the alert. It is also told, in as many words, that guessing is worse than handing
    /// the alert back: an unresolved alert with good findings is a useful outcome, and a "fix"
    /// applied to production on a hunch is not.
    /// </remarks>
    public static string BuildAlertInvestigation(ListedAlert? alert, OperationsOptions operations)
    {
        var prompt = new StringBuilder()
            .AppendLine("You are on call for a production system. An alert has fired and you are investigating it.")
            .AppendLine()
            .AppendLine("Alert:")
            .AppendLine($"- Source: {alert?.Source.Value ?? "unknown"}")
            .AppendLine($"- Severity: {alert?.Severity.ToString() ?? "unknown"}")
            .AppendLine($"- Title: {alert?.Title.Value ?? "unknown"}")
            .AppendLine($"- Seen {alert?.Occurrences ?? 1} time(s), most recently {alert?.LastObservedAt?.ToString("u") ?? "unknown"}")
            .AppendLine("- Detail:")
            .AppendLine(Indent(alert?.Summary.Value ?? string.Empty));

        AppendAccess(prompt, operations);

        prompt
            .AppendLine()
            .AppendLine("Instructions:")
            .AppendLine("- Establish what is actually wrong before doing anything about it. Read the state of the running system and its logs; correlate what you find with the code you have. Delegate broad searching to subagents to keep your main context lean.")
            .AppendLine("- Decide honestly whether this is something you can resolve. Restarting a stuck workload, clearing a full ephemeral volume, or re-rolling a deployment that failed to pull an image are the kinds of things you can. A code defect, data loss, a capacity decision, anything needing a credential you were not given, and anything you are unsure about are not.")
            .AppendLine("- If you can resolve it: do it, then verify it against fresh signal - the workload healthy, the probe passing, the condition gone. Your own reasoning is not verification.")
            .AppendLine("- If you cannot resolve it: change nothing. Say what is wrong, what evidence you have, and what you would do next. Handing an alert back with good findings is a good outcome; guessing at production is not.")
            .AppendLine("- Never widen access you were given, and never disable an alert or a health check to make a symptom go away.");

        if (!string.IsNullOrWhiteSpace(operations.Runbook))
        {
            prompt.AppendLine().AppendLine("Standing instructions for this deployment:").AppendLine(operations.Runbook);
        }

        prompt
            .AppendLine()
            .AppendLine($"End your final message with a line `{AlertOutcomeMarker} {AlertResolvedOutcome}` or `{AlertOutcomeMarker} {AlertNeedsAttentionOutcome}`, followed by your findings in markdown: what was wrong, what evidence you have, and what you did or would do about it.");
        return prompt.ToString();
    }

    static void AppendAccess(StringBuilder prompt, OperationsOptions operations)
    {
        prompt.AppendLine().AppendLine("What you can reach:");
        var any = false;

        if (!string.IsNullOrWhiteSpace(operations.Kubeconfig))
        {
            var @namespace = string.IsNullOrWhiteSpace(operations.KubernetesNamespace) ? "the default namespace" : $"namespace `{operations.KubernetesNamespace}`";
            prompt.AppendLine($"- Kubernetes, through `kubectl` with a kubeconfig already in place, working in {@namespace}.");
            any = true;
        }

        if (!string.IsNullOrWhiteSpace(operations.DockerHost))
        {
            prompt.AppendLine("- A Docker daemon, through the `docker` CLI (DOCKER_HOST is set).");
            any = true;
        }

        if (!string.IsNullOrWhiteSpace(operations.LokiUrl))
        {
            prompt.AppendLine("- Logs in Loki at $PLANNER_LOKI_URL - query it with `curl` against `/loki/api/v1/query_range` (credentials, when needed, are in $PLANNER_LOKI_USERNAME / $PLANNER_LOKI_PASSWORD).");
            any = true;
        }

        if (!string.IsNullOrWhiteSpace(operations.GrafanaUrl))
        {
            prompt.AppendLine("- Grafana at $PLANNER_GRAFANA_URL, with an API token in $PLANNER_GRAFANA_TOKEN.");
            any = true;
        }

        if (!any)
        {
            prompt.AppendLine("- Nothing. This deployment gave you no access to the running system, so you can only reason from the alert itself and any source you have. Say so in your findings rather than guessing.");
        }
    }

    static string Indent(string value) => $"  {value.ReplaceLineEndings("\n  ")}";

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
            .AppendLine("- Follow the conventions and agent instructions of the repository. Keep your main context lean: delegate large exploration and reading to subagents and keep the main thread for deciding, editing and verifying.")
            .AppendLine("- Verification has teeth: confirm every claim of done or fixed against a fresh signal - a build, a test run, observed behavior - never your own assessment. A green build is not behavioral correctness.")
            .AppendLine("- Build and run the tests; everything must be green before you finish.")
            .AppendLine("- Commit in logical units with clear messages and push your branch.")
            .AppendLine("- Open a single pull request with `gh pr create` covering the work, referencing each issue so it closes on merge. Include in the description what you verified - and explicitly name anything you did not verify.")
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
            .AppendLine("- For a reported bug, first try to reproduce it - follow the reported steps, or write and run a failing test that captures the reported behavior. State clearly in your plan whether you could reproduce it and how - the reproduction signal is evidence, your reading of the code is not.")
            .AppendLine("- Study the codebase and produce a concrete plan for how each issue can be implemented or fixed. Delegate large exploration to subagents to keep your main context lean.")
            .AppendLine("- State in the plan what is settled and must not be redone, and what genuinely requires a human decision.")
            .AppendLine("- If you cannot determine a confident plan, or a bug does not reproduce, ask the team for more input by commenting on the issue with `gh issue comment`.")
            .AppendLine("- Suggest which Claude model should implement the work: `haiku` for trivial changes, `sonnet` for regular work, `opus` for hard or risky work.")
            .AppendLine($"- End your final message with a line `{SuggestedModelMarker} <model>` followed by the plan in markdown.");
        return prompt.ToString();
    }

    static void AppendIssues(StringBuilder prompt, IReadOnlyList<ListedIssue> issues)
    {
        foreach (var issue in issues)
        {
            prompt.AppendLine($"- {issue.Owner.Value}/{issue.Repository.Value}#{issue.Number.Value}: {issue.Title.Value}");
            if (issue.Prompt?.Equals(WorkPrompt.NotSet) == false)
            {
                prompt.AppendLine($"  Additional instructions for this issue:\n  {issue.Prompt.Value.ReplaceLineEndings("\n  ")}");
            }

            if (issue.Investigation?.Equals(InvestigationSummary.NotSet) == false)
            {
                prompt.AppendLine($"  An earlier investigation produced this plan:\n  {issue.Investigation.Value.ReplaceLineEndings("\n  ")}");
            }
        }
    }
}

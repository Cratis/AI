// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.RegularExpressions;

namespace Planner.Work.Callback;

/// <summary>
/// The coordinates of a pull request found in a worker's reported result.
/// </summary>
/// <param name="Owner">The organization owning the repository.</param>
/// <param name="Repository">The repository the pull request was opened in.</param>
/// <param name="Number">The pull request number.</param>
/// <param name="Url">The html URL of the pull request.</param>
public record ReportedPullRequest(OrganizationName Owner, RepositoryName Repository, PullRequestNumber Number, PullRequestUrl Url);

/// <summary>
/// Parses the free-form result a worker reports back into the structured facts the Planner records.
/// </summary>
public static partial class WorkerResults
{
    [GeneratedRegex(@"https://github\.com/(?<owner>[\w.-]+)/(?<repo>[\w.-]+)/pull/(?<number>\d+)", RegexOptions.None, 1000)]
    private static partial Regex PullRequestUrlExpression { get; }

    [GeneratedRegex(@"^SUGGESTED-MODEL:[ \t]*(?<model>[\w.-]+)[ \t]*$", RegexOptions.Multiline, 1000)]
    private static partial Regex SuggestedModelExpression { get; }

    /// <summary>
    /// Finds the last pull request URL mentioned in a worker's result - the pull request the work produced.
    /// </summary>
    /// <param name="result">The reported result text.</param>
    /// <returns>The <see cref="ReportedPullRequest"/>, or <see langword="null"/> when none is mentioned.</returns>
    public static ReportedPullRequest? TryFindPullRequest(string result)
    {
        var matches = PullRequestUrlExpression.Matches(result);
        if (matches.Count == 0)
        {
            return null;
        }

        var match = matches[^1];
        return new(
            match.Groups["owner"].Value,
            match.Groups["repo"].Value,
            int.Parse(match.Groups["number"].Value),
            match.Value);
    }

    /// <summary>
    /// Finds the model an investigation suggested through its <c>SUGGESTED-MODEL:</c> marker line.
    /// </summary>
    /// <param name="result">The reported result text.</param>
    /// <returns>The suggested model, or <see langword="null"/> when the marker is absent.</returns>
    public static ModelName? TryFindSuggestedModel(string result)
    {
        var match = SuggestedModelExpression.Match(result);
        return match.Success ? new ModelName(match.Groups["model"].Value) : null;
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Issues.ClassifyingForAutoMerge;

/// <summary>
/// Builds the prompt the auto-merge classification reactor asks the language model whether a pull
/// request is safe to merge on its own.
/// </summary>
public static class MergeClassificationPrompts
{
    const string ResponseShape =
        """
        Respond with ONLY a single JSON object, no other text, matching exactly this shape:
        {
          "verdict": "mergeable-now" | "needs-human",
          "reason": "one sentence explaining the verdict"
        }

        Judge "mergeable-now" only for changes that are obviously low-risk from the title and
        description alone - documentation, a dependency bump, a small well-described fix. Anything
        that touches behavior in a way you cannot fully judge from the title and description, or
        that sounds like it could be risky, needs a human.
        """;

    /// <summary>
    /// Builds the classification prompt for a pull request.
    /// </summary>
    /// <param name="title">The issue's title - what the pull request set out to do.</param>
    /// <param name="pullRequestUrl">The html URL of the pull request.</param>
    /// <returns>The prompt.</returns>
    public static string Classify(string title, string pullRequestUrl) =>
        $"""
        A pull request was opened for this issue: "{title}"
        Pull request: {pullRequestUrl}

        No diff content is available - only the issue title and the pull request URL.


        """ + ResponseShape;
}

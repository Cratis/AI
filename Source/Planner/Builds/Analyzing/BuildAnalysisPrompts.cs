// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Builds.RecordingStatus;

namespace Planner.Builds.Analyzing;

/// <summary>
/// Builds the prompt the build failure analysis reactor asks the language model to assess a newly
/// failing build with.
/// </summary>
public static class BuildAnalysisPrompts
{
    const string ResponseShape =
        """
        Respond with ONLY a single JSON object, no other text, matching exactly this shape:
        {
          "diagnosis": "one or two sentences on what is likely wrong, from the information given",
          "fixable": true | false
        }

        Set "fixable" to true only when this is the kind of failure a coding agent could plausibly
        diagnose and fix by looking at the repository (e.g. a dependency bump broke a build, a test
        needs updating) - not for anything that needs infrastructure access, credentials, or a
        product decision.
        """;

    /// <summary>
    /// Builds the assessment prompt for a newly failing build.
    /// </summary>
    /// <param name="event">The <see cref="BuildStatusRecorded"/> event describing the failure.</param>
    /// <returns>The prompt.</returns>
    public static string Assess(BuildStatusRecorded @event) =>
        $"""
        The "{@event.Workflow.Value}" GitHub Actions workflow in {@event.Owner.Value}/{@event.Repository.Value} just
        started failing. The most recent run is at {@event.RunUrl.Value}. No log content is available -
        only the workflow name, the repository, and that it is now failing.


        """ + ResponseShape;
}

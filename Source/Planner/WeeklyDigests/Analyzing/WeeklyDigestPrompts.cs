// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.WeeklyDigests.Receiving;

namespace Planner.WeeklyDigests.Analyzing;

/// <summary>
/// Builds the prompt the weekly digest analysis reactor asks the language model to extract themes
/// and a description from a digest's raw content.
/// </summary>
public static class WeeklyDigestPrompts
{
    const string ResponseShape =
        """
        Respond with ONLY a single JSON object, no other text, matching exactly this shape:
        {
          "themes": ["short theme name", ...],
          "description": "a short, warm, personal write-up of the week - the kind of copy a team
            posts publicly to celebrate what shipped. Something in the direction of 'Wow, what a
            week...', 'Another week flew by and the team has been hard at work', 'At lightning
            speed, we're delivering yet another week of value...' - genuinely feel real rather than
            corporate, two to four sentences."
        }
        """;

    /// <summary>
    /// Builds the extraction prompt for a weekly digest.
    /// </summary>
    /// <param name="event">The <see cref="WeeklyDigestReceived"/> event carrying the raw content.</param>
    /// <returns>The prompt.</returns>
    public static string Extract(WeeklyDigestReceived @event) =>
        $"""
        Here is this week's digest content:

        {@event.Content.Value}


        """ + ResponseShape;
}

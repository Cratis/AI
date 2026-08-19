// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Planner.LanguageModels;
using Planner.WeeklyDigests.ExtractingThemes;
using Planner.WeeklyDigests.GeneratingDescription;
using Planner.WeeklyDigests.Receiving;

namespace Planner.WeeklyDigests.Analyzing;

/// <summary>
/// Reacts to a received weekly digest by asking the language model to extract its themes and
/// suggest a description - two separate facts, since a person may keep the themes and rewrite only
/// the description, or the reverse. The digest moves to <see cref="WeeklyDigestStatus.Unpublished"/>
/// once the description exists. Degrades silently to no analysis when no language model is
/// configured, leaving the digest at <see cref="WeeklyDigestStatus.Received"/> for a person to
/// write the description by hand.
/// </summary>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="languageModel">The <see cref="ILanguageModel"/> the extraction is asked from.</param>
/// <param name="systemExecution">The <see cref="ISystemExecution"/> the commands below run as - there is no HTTP request behind this.</param>
public class WeeklyDigestAnalysis(ICommandPipeline commandPipeline, ILanguageModel languageModel, ISystemExecution systemExecution) : IReactor
{
    /// <summary>
    /// Extracts themes and a description from a newly received weekly digest.
    /// </summary>
    /// <param name="event">The <see cref="WeeklyDigestReceived"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public async Task On(WeeklyDigestReceived @event, EventContext context)
    {
        var result = await languageModel.Complete(WeeklyDigestPrompts.Extract(@event));
        if (!result.Succeeded)
        {
            return;
        }

        var extraction = WeeklyDigestExtraction.Parse(result.Text);
        if (extraction is null)
        {
            return;
        }

        var id = new WeeklyDigestId(Guid.Parse(context.EventSourceId.Value));

        // One scope for both commands - extracting themes and generating the description are one
        // logical analysis, and a reactor has no HTTP request behind it.
        using var scope = systemExecution.AsSystem();

        await commandPipeline.Execute(new ExtractWeeklyDigestThemes(id, extraction.Themes));
        await commandPipeline.Execute(new GenerateWeeklyDigestDescription(id, extraction.Description));
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Builds.RecordingDiagnosis;
using Planner.Builds.RecordingStatus;
using Planner.LanguageModels;
using Planner.Work.SchedulingAdHoc;

namespace Planner.Builds.Analyzing;

/// <summary>
/// Reacts to a workflow starting to fail by asking the language model what is likely wrong and
/// whether an agent could plausibly fix it - once per failure, not once per daily check while it
/// stays red (<see cref="BuildStatusRecorded.IsNewFailure"/>). When the model judges it fixable, ad-hoc
/// work is scheduled against the repository; either way, the diagnosis is recorded so the Failed
/// builds page shows more than just "failing". Degrades silently to no diagnosis when no language
/// model is configured.
/// </summary>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> for executing commands.</param>
/// <param name="languageModel">The <see cref="ILanguageModel"/> the assessment is asked from.</param>
public class BuildFailureAnalysis(ICommandPipeline commandPipeline, ILanguageModel languageModel) : IReactor
{
    /// <summary>
    /// Assesses a newly failing build.
    /// </summary>
    /// <param name="event">The <see cref="BuildStatusRecorded"/> event.</param>
    /// <param name="context">The <see cref="EventContext"/>.</param>
    /// <returns>Awaitable task.</returns>
    [OnceOnly]
    public async Task On(BuildStatusRecorded @event, EventContext context)
    {
        if (!@event.IsNewFailure)
        {
            return;
        }

        var result = await languageModel.Complete(BuildAnalysisPrompts.Assess(@event));
        if (!result.Succeeded)
        {
            return;
        }

        var assessment = BuildAssessment.Parse(result.Text);
        if (assessment is null)
        {
            return;
        }

        var workflowId = new BuildWorkflowId(context.EventSourceId.Value);
        await commandPipeline.Execute(new RecordBuildDiagnosis(workflowId, assessment.Diagnosis, assessment.Fixable));

        if (assessment.Fixable)
        {
            await commandPipeline.Execute(new ScheduleAdHocWork(
                $"The \"{@event.Workflow.Value}\" GitHub Actions workflow in {@event.Owner.Value}/{@event.Repository.Value} " +
                $"is failing ({@event.RunUrl.Value}). Diagnosis: {assessment.Diagnosis.Value}\n\n" +
                "Look at the most recent run and fix it, or open an issue explaining what is wrong if it turns out not to be something you can fix.",
                [RepositoryId.From(@event.Owner, @event.Repository)]));
        }
    }
}

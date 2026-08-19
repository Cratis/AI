// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Builds.RecordingStatus;

namespace Planner.Builds.Analyzing.for_BuildFailureAnalysis.when_a_workflow_starts_failing;

public class and_it_is_not_a_new_failure : given.a_reactor
{
    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_workflowId)
            .Events(new BuildStatusRecorded("Cratis", "Studio", "Update Packages", BuildConclusion.Failure, "https://github.com/Cratis/Studio/actions/runs/2", DateTimeOffset.UnixEpoch, false));

    [Fact]
    async Task should_not_ask_the_language_model() =>
        await _languageModel.DidNotReceive().Complete(Arg.Any<string>(), Arg.Any<CancellationToken>());
}
#endif

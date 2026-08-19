// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.LanguageModels;
using Planner.WeeklyDigests.ExtractingThemes;
using Planner.WeeklyDigests.Receiving;

namespace Planner.WeeklyDigests.Analyzing.for_WeeklyDigestAnalysis.when_a_digest_is_received;

public class and_no_language_model_is_configured : given.a_reactor
{
    void Establish() =>
        _languageModel.Complete(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(LanguageModelResult.Failure("No language model is configured"));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(new WeeklyDigestReceived("Shipped the new dashboard."));

    [Fact]
    async Task should_not_record_anything() =>
        await _commandPipeline.DidNotReceive().Execute(Arg.Any<ExtractWeeklyDigestThemes>());
}
#endif

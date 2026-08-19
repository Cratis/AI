// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.LanguageModels;
using Planner.WeeklyDigests.ExtractingThemes;
using Planner.WeeklyDigests.GeneratingDescription;
using Planner.WeeklyDigests.Receiving;

namespace Planner.WeeklyDigests.Analyzing.for_WeeklyDigestAnalysis.when_a_digest_is_received;

public class and_the_language_model_extracts_it : given.a_reactor
{
    void Establish() =>
        _languageModel.Complete(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(LanguageModelResult.Success(
            """
            { "themes": ["Dashboard"], "description": "Wow, what a week." }
            """));

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_id)
            .Events(new WeeklyDigestReceived("Shipped the new dashboard."));

    [Fact]
    async Task should_record_the_themes() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<ExtractWeeklyDigestThemes>(command => command.WeeklyDigest == _id && command.Themes.Single() == "Dashboard"));

    [Fact]
    async Task should_record_the_description() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<GenerateWeeklyDigestDescription>(command => command.WeeklyDigest == _id && command.Description == new WeeklyDigestDescription("Wow, what a week.")));
}
#endif

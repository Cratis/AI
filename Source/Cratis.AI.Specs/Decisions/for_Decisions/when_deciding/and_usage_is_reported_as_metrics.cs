// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Decisions.Usage;
using Cratis.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

public class and_usage_is_reported_as_metrics : given.all_dependencies
{
    given.telemetry_recording_usage _recording;

    void Establish()
    {
        _recording = new();
        ClientAnswers(("bug", 0.8), ("feature", 0.2));
        _decisions = new(
            _resolver,
            new KnownInstancesOf<IDecisionEngineClient>(_client),
            new DecisionUsageRecorder(_recording, Substitute.For<ILogger<DecisionUsageRecorder>>()),
            _recording,
            Options.Create(_options),
            Substitute.For<ILogger<Decisions>>());
    }

    async Task Because() => await _decisions.Decide(RequestFor("bug", "feature") with { Topic = "classification" });

    [Fact] void should_report_the_engine_usage() => _recording.Usages.ShouldContainOnly([(DecisionEngineType.BuiltIn, _model, (DecisionTopic)"classification", 1, 2, 42L, 7L)]);
    [Fact] void should_not_depend_on_the_command_pipeline() => typeof(DecisionUsageRecorder).GetConstructors().SelectMany(_ => _.GetParameters()).Select(_ => _.ParameterType).ShouldNotContain(typeof(ICommandPipeline));
}

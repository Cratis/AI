// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Decisions.Usage;
using Cratis.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

public class and_telemetry_fails : given.all_dependencies
{
    DecisionResult _result;
    Exception? _error;

    void Establish()
    {
        ClientAnswers(("bug", 0.8), ("feature", 0.2));
        var failing = new given.telemetry_recording_usage(fail: true);
        _decisions = new(
            _resolver,
            new KnownInstancesOf<IDecisionEngineClient>(_client),
            new DecisionUsageRecorder(failing, Substitute.For<ILogger<DecisionUsageRecorder>>()),
            failing,
            Options.Create(_options),
            Substitute.For<ILogger<Decisions>>());
    }

    async Task Because() => _error = await Catch.Exception(async () => _result = await _decisions.Decide(RequestFor("bug", "feature")));

    [Fact] void should_not_fail_the_decision() => _error.ShouldBeNull();
    [Fact] void should_preserve_the_answer() => _result.Top.ShouldEqual((DecisionChoiceId)"bug");
}

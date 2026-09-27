// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// Every call that produced an answer is recorded as usage, the same way a completion is - with what
/// the engine reported, not with what the caller guessed.
/// </summary>
public class and_the_engine_answers : given.all_dependencies
{
    void Establish() => ClientAnswers(("bug", 0.8), ("feature", 0.2));

    async Task Because() => await _decisions.Decide(RequestFor("bug", "feature"));

    [Fact] void should_record_the_usage() => _usage.Received(1).Record(
        Arg.Is<IReadOnlyList<DecisionRequest>>(_ => _.Count == 1),
        _connection,
        Arg.Is<DecisionEngineAnswers>(_ => _.InputTokens == 42 && _.OutputTokens == 7),
        Arg.Any<TimeSpan>());
}

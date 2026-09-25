// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// An engine in force that no registered client can talk to fails before any call is made, so the
/// failure names the missing client instead of surfacing later as something harder to read.
/// </summary>
public class and_there_is_no_client_for_the_engine : given.all_dependencies
{
    Exception _result;

    void Establish() => EngineIs(DecisionEngineType.Jev);

    async Task Because() => _result = await Catch.Exception(() => _decisions.Decide(RequestFor("plan", "implement")));

    [Fact] void should_refuse() => _result.ShouldBeOfExactType<NoClientForDecisionEngine>();
    [Fact] void should_not_ask_any_client() => _client.DidNotReceive().Decide(Arg.Any<IReadOnlyList<DecisionRequest>>(), Arg.Any<DecisionEngineConnection>(), Arg.Any<CancellationToken>());
}

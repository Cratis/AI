// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// A missing choice is a contract violation, not a zero. Filling it in silently would make "the
/// provider considered this impossible" indistinguishable from "the provider never looked at it",
/// and those want opposite responses from a caller.
/// </summary>
public class and_the_provider_omits_a_supplied_choice : given.all_dependencies
{
    Exception _result;

    void Establish() => ClientAnswers(("plan", 0.6), ("implement", 0.4));

    async Task Because() => _result = await Catch.Exception(() => _decisions.Decide(RequestFor("plan", "implement", "ask_user")));

    [Fact] void should_refuse_the_result() => _result.ShouldBeOfExactType<DecisionChoicesNotCovered>();
    [Fact] void should_name_the_missing_choice() => _result.Message.ShouldContain("ask_user");
}

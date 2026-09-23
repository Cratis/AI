// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// One choice is an unambiguous answer, so the margin is full rather than zero - a margin of zero
/// would read as "too close to call" to every consumer's threshold and send the one decision that
/// cannot be wrong down the escalation path.
/// </summary>
public class and_a_single_choice_is_supplied : given.all_dependencies
{
    DecisionResult _result;

    void Establish() => ClientAnswers(("finish", 1.0));

    async Task Because() => _result = await _decisions.Decide(RequestFor("finish"));

    [Fact] void should_pick_it() => _result.Top.Value.ShouldEqual("finish");
    [Fact] void should_report_a_full_margin() => _result.Margin.ShouldEqual(1d);
}

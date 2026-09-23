// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// The shape every consumer reads: the raw distribution untouched, plus the two derived values
/// - the winner and the distance to the runner-up - that a threshold is applied to.
/// </summary>
public class and_the_provider_returns_a_distribution : given.all_dependencies
{
    DecisionResult _result;

    void Establish() => ClientAnswers(("investigate", 0.05), ("plan", 0.12), ("implement", 0.82), ("ask_user", 0.01));

    async Task Because() => _result = await _decisions.Decide(RequestFor("investigate", "plan", "implement", "ask_user"));

    [Fact] void should_pick_the_highest_probability_choice() => _result.Top.Value.ShouldEqual("implement");
    [Fact] void should_carry_the_top_probability() => _result.TopProbability.ShouldEqual(0.82);
    [Fact] void should_derive_the_margin_to_the_runner_up() => Math.Round(_result.Margin, 2).ShouldEqual(0.70);
    [Fact] void should_order_the_outcomes_by_probability_descending() => _result.Outcomes.Select(_ => _.Choice.Value).ShouldEqual(["implement", "plan", "investigate", "ask_user"]);
    [Fact] void should_keep_every_supplied_choice() => _result.Outcomes.Count.ShouldEqual(4);
    [Fact] void should_report_the_model_that_answered() => _result.Model.ShouldEqual(_model);
}

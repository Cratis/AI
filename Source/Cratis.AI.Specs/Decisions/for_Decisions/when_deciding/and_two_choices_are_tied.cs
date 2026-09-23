// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// A tie has to resolve the same way every time or an idempotent workflow stops being idempotent.
/// It resolves to whichever choice the caller listed first - the workflow's own ordering, which is
/// the only ordering that means anything here.
/// </summary>
public class and_two_choices_are_tied : given.all_dependencies
{
    DecisionResult _result;

    void Establish() => ClientAnswers(("retry", 0.5), ("finish", 0.5));

    async Task Because() => _result = await _decisions.Decide(RequestFor("retry", "finish"));

    [Fact] void should_pick_the_first_supplied_choice() => _result.Top.Value.ShouldEqual("retry");
    [Fact] void should_report_no_margin() => _result.Margin.ShouldEqual(0d);
}

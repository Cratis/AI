// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

public class and_too_many_choices_are_supplied : given.all_dependencies
{
    Exception _result;

    void Establish() => _options.MaxChoices = 2;

    async Task Because() => _result = await Catch.Exception(() => _decisions.Decide(RequestFor("a", "b", "c")));

    [Fact] void should_refuse_to_ask() => _result.ShouldBeOfExactType<DecisionRequestIsNotAnswerable>();
}

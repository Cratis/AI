// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

public class and_no_engine_is_available : given.all_dependencies
{
    Exception _result;

    void Establish() => NoEngineIsResolved();

    async Task Because() => _result = await Catch.Exception(() => _decisions.Decide(RequestFor("plan", "implement")));

    [Fact] void should_say_so_explicitly() => _result.ShouldBeOfExactType<DecisionEngineNotAvailable>();
}

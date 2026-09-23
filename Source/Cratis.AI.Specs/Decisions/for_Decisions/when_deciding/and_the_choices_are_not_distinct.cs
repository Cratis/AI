// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// A duplicated choice would collapse on the way back - one key, two claims on it - leaving a
/// distribution that no longer sums to what the provider computed.
/// </summary>
public class and_the_choices_are_not_distinct : given.all_dependencies
{
    Exception _result;

    async Task Because() => _result = await Catch.Exception(() => _decisions.Decide(RequestFor("retry", "retry")));

    [Fact] void should_refuse_to_ask() => _result.ShouldBeOfExactType<DecisionRequestIsNotAnswerable>();
}

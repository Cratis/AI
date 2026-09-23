// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// Rejected rather than forwarded. A provider handed an empty context still answers with a
/// distribution, and the caller reading it has no way to tell that the number in front of it means
/// nothing at all.
/// </summary>
public class and_the_context_is_empty : given.all_dependencies
{
    Exception _result;

    async Task Because() => _result = await Catch.Exception(() =>
        _decisions.Decide(new DecisionRequest(new DecisionContext(), [(DecisionChoiceId)"plan"])));

    [Fact] void should_refuse_to_ask() => _result.ShouldBeOfExactType<DecisionRequestIsNotAnswerable>();
    [Fact] void should_not_reach_the_provider() => _client.ReceivedCalls().ShouldBeEmpty();
}

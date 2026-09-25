// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.Jev.for_JevDecisionEngineClient.when_deciding;

public class and_the_requests_have_different_contexts : given.a_jev_client
{
    DecisionEngineAnswers _result;

    void Establish()
    {
        JevAnswers("""{ "model": "jev-1.13.0", "answers": { "q0": { "type": "choice", "probabilities": { "a": 1.0, "b": 0.0 } } }, "usage": { "input_tokens": 10, "output_tokens": 1 } }""");
        JevAnswers("""{ "model": "jev-1.13.0", "answers": { "q1": { "type": "choice", "probabilities": { "a": 0.0, "b": 1.0 } } }, "usage": { "input_tokens": 20, "output_tokens": 2 } }""");
    }

    async Task Because() => _result = await _client.Decide(
        [
            DecisionRequest.For("first context", "a", "b"),
            DecisionRequest.For("second context", "a", "b")
        ],
        _connection);

    [Fact] void should_make_a_call_per_context() => _requests.Count.ShouldEqual(2);
    [Fact] void should_keep_the_answers_in_request_order() => _result.Distributions[1].Single(_ => _.Choice == "b").Probability.ShouldEqual(1.0);
    [Fact] void should_add_up_the_input_tokens() => _result.InputTokens.ShouldEqual(30);
}

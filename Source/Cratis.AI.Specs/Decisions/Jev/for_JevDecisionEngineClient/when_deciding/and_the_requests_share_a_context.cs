// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;

namespace Cratis.AI.Decisions.Jev.for_JevDecisionEngineClient.when_deciding;

/// <summary>
/// Questions against the same context go out as one request - Jev evaluates them in parallel and
/// bills for the state once, which is the whole reason a batch of per-label decisions is cheap.
/// </summary>
public class and_the_requests_share_a_context : given.a_jev_client
{
    static readonly DecisionContext _context = DecisionContext.FromText("Issue: the build fails on main");

    DecisionEngineAnswers _result;

    void Establish() => JevAnswers(
        """{ "model": "jev-1.13.0", "answers": { "q0": { "type": "choice", "choice": "bug", "confidence": 0.9, "probabilities": { "bug": 0.9, "feature": 0.1 } }, "q1": { "type": "choice", "choice": "apply", "confidence": 0.7, "probabilities": { "apply": 0.7, "skip": 0.3 } } }, "usage": { "input_tokens": 451, "output_tokens": 72 } }""");

    async Task Because() => _result = await _client.Decide(
        [
            new DecisionRequest(_context, ["bug", "feature"], "What kind of issue is this?", new Dictionary<DecisionChoiceId, string> { ["bug"] = "something is broken" }),
            new DecisionRequest(_context, ["apply", "skip"], "Does the label 'ci' apply?")
        ],
        _connection);

    [Fact] void should_make_a_single_call() => _requests.Count.ShouldEqual(1);
    [Fact] void should_call_the_system_one_endpoint() => _requests[0].Request.RequestUri!.ToString().ShouldEqual("https://api.typesafe.ai/v1/systemone");
    [Fact] void should_authenticate_with_the_api_key() => _requests[0].Request.Headers.Authorization!.ToString().ShouldEqual("Bearer jv_live_key");
    [Fact] void should_ask_for_the_configured_model() => _requests[0].Body["model"]!.GetValue<string>().ShouldEqual("jev-latest");
    [Fact] void should_send_the_context_as_state() => _requests[0].Body["state"]!.GetValue<string>().ShouldEqual("Issue: the build fails on main");
    [Fact] void should_ask_both_questions() => ((JsonObject)_requests[0].Body["questions"]!).Count.ShouldEqual(2);
    [Fact] void should_ask_choice_questions() => _requests[0].Body["questions"]!["q0"]!["type"]!.GetValue<string>().ShouldEqual("choice");
    [Fact] void should_send_the_question_as_instructions() => _requests[0].Body["questions"]!["q0"]!["instructions"]!.GetValue<string>().ShouldEqual("What kind of issue is this?");
    [Fact] void should_describe_the_described_choices() => _requests[0].Body["questions"]!["q0"]!["criteria"]!["bug"]!.GetValue<string>().ShouldEqual("something is broken");
    [Fact] void should_keep_undescribed_choices() => ((JsonObject)_requests[0].Body["questions"]!["q0"]!["criteria"]!).ContainsKey("feature").ShouldBeTrue();
    [Fact] void should_return_a_distribution_per_request() => _result.Distributions.Count.ShouldEqual(2);
    [Fact] void should_map_the_first_answer_to_the_first_request() => _result.Distributions[0].Single(_ => _.Choice == "bug").Probability.ShouldEqual(0.9);
    [Fact] void should_map_the_second_answer_to_the_second_request() => _result.Distributions[1].Single(_ => _.Choice == "apply").Probability.ShouldEqual(0.7);
    [Fact] void should_report_the_model_that_answered() => _result.Model.Value.ShouldEqual("jev-1.13.0");
    [Fact] void should_report_the_input_tokens() => _result.InputTokens.ShouldEqual(451);
    [Fact] void should_report_the_output_tokens() => _result.OutputTokens.ShouldEqual(72);
}

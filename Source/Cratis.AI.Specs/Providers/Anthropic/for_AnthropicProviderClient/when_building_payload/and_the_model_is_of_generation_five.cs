// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.Anthropic.for_AnthropicProviderClient.when_building_payload;

/// <summary>
/// Generation 5 models refuse a thinking budget - "thinking.type.enabled is not supported for this model" -
/// so they are asked for adaptive thinking steered by an effort level instead.
/// </summary>
public class and_the_model_is_of_generation_five : Specification
{
    JsonObject _payload;

    void Because() => _payload = AnthropicProviderClient.BuildPayload(new ModelName("claude-sonnet-5-5"), "prompt", Effort.High);

    [Fact] void should_ask_for_adaptive_thinking() => _payload["thinking"]!["type"]!.GetValue<string>().ShouldEqual("adaptive");
    [Fact] void should_send_no_thinking_budget() => _payload["thinking"]!["budget_tokens"].ShouldBeNull();
    [Fact] void should_steer_with_an_effort_level() => _payload["output_config"]!["effort"]!.GetValue<string>().ShouldEqual("high");
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.Anthropic.for_AnthropicProviderClient.when_building_payload;

public class and_effort_is_high : Specification
{
    JsonObject _payload;

    void Because() => _payload = AnthropicProviderClient.BuildPayload(new ModelName("claude-3-5-haiku-latest"), "prompt", Effort.High);

    [Fact] void should_carry_a_larger_budget_than_medium() => _payload["thinking"]!["budget_tokens"]!.GetValue<int>().ShouldEqual(8192);
    [Fact] void should_raise_max_tokens_above_the_budget() => _payload["max_tokens"]!.GetValue<int>().ShouldBeGreaterThan(8192);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.Anthropic.for_AnthropicProviderClient.when_building_payload;

public class and_effort_is_extra_high : Specification
{
    JsonObject _payload;

    void Because() => _payload = AnthropicProviderClient.BuildPayload(new ModelName("claude-3-5-haiku-latest"), "prompt", Effort.ExtraHigh);

    [Fact] void should_carry_the_largest_budget() => _payload["thinking"]!["budget_tokens"]!.GetValue<int>().ShouldEqual(16384);
    [Fact] void should_raise_max_tokens_above_the_budget() => _payload["max_tokens"]!.GetValue<int>().ShouldBeGreaterThan(16384);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.Anthropic.for_AnthropicProviderClient.when_building_payload;

public class and_effort_is_medium : Specification
{
    JsonObject _payload;

    void Because() => _payload = AnthropicProviderClient.BuildPayload(new ModelName("claude-3-5-haiku-latest"), "prompt", Effort.Medium);

    [Fact] void should_enable_thinking_with_the_minimum_budget() => _payload["thinking"]!["budget_tokens"]!.GetValue<int>().ShouldEqual(4096);
    [Fact] void should_raise_max_tokens_above_the_budget() => _payload["max_tokens"]!.GetValue<int>().ShouldBeGreaterThan(4096);
}

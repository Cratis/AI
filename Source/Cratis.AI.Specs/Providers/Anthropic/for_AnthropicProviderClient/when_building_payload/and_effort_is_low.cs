// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.Anthropic.for_AnthropicProviderClient.when_building_payload;

public class and_effort_is_low : Specification
{
    JsonObject _payload;

    void Because() => _payload = AnthropicProviderClient.BuildPayload(new ModelName("claude-3-5-haiku-latest"), "prompt", Effort.Low);

    [Fact] void should_not_enable_thinking() => _payload.ContainsKey("thinking").ShouldBeFalse();
    [Fact] void should_carry_the_prompt() => _payload["messages"]![0]!["content"]!.GetValue<string>().ShouldEqual("prompt");
}

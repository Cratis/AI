// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.Agents;

namespace Cratis.AI.Providers.for_OpenAIChatCompletionsProtocol.when_building_payload;

public class and_effort_is_low : Specification
{
    JsonObject _payload;

    void Because() => _payload = OpenAIChatCompletionsProtocol.BuildPayload("gpt-4o-mini", "prompt", Effort.Low);

    [Fact] void should_carry_low_reasoning_effort() => _payload["reasoning_effort"]!.GetValue<string>().ShouldEqual("low");
    [Fact] void should_carry_the_model() => _payload["model"]!.GetValue<string>().ShouldEqual("gpt-4o-mini");
    [Fact] void should_carry_the_prompt_as_a_user_message() => _payload["messages"]![0]!["content"]!.GetValue<string>().ShouldEqual("prompt");
}

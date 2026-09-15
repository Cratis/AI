// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.Agents;

namespace Cratis.AI.Providers.for_OpenAIChatCompletionsProtocol.when_building_payload;

public class and_effort_is_medium : Specification
{
    JsonObject _payload;

    void Because() => _payload = OpenAIChatCompletionsProtocol.BuildPayload("gpt-4o-mini", "prompt", Effort.Medium);

    [Fact] void should_carry_medium_reasoning_effort() => _payload["reasoning_effort"]!.GetValue<string>().ShouldEqual("medium");
}

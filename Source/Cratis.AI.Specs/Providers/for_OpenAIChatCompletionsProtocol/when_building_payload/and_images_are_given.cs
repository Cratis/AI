// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_OpenAIChatCompletionsProtocol.when_building_payload;

public class and_images_are_given : Specification
{
    JsonObject _payload;
    JsonArray _content;

    void Because()
    {
        _payload = OpenAIChatCompletionsProtocol.BuildPayload("gpt-4o", "prompt", [new(new byte[] { 1, 2, 3 }, "image/jpeg")], Effort.Low);
        _content = _payload["messages"]![0]!["content"]!.AsArray();
    }

    [Fact] void should_have_an_image_part_and_a_text_part() => _content.Count.ShouldEqual(2);
    [Fact] void should_lead_with_the_image() => _content[0]!["type"]!.GetValue<string>().ShouldEqual("image_url");
    [Fact] void should_send_the_image_as_a_data_url() => _content[0]!["image_url"]!["url"]!.GetValue<string>().ShouldEqual($"data:image/jpeg;base64,{Convert.ToBase64String(new byte[] { 1, 2, 3 })}");
    [Fact] void should_follow_with_the_prompt_text() => _content[1]!["text"]!.GetValue<string>().ShouldEqual("prompt");
}

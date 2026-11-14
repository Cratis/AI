// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.Anthropic.for_AnthropicProviderClient.when_building_payload;

public class and_images_are_given : Specification
{
    JsonObject _payload;
    JsonArray _content;

    void Because()
    {
        _payload = AnthropicProviderClient.BuildPayload(new ModelName("claude-3-5-haiku-latest"), "prompt", [new(new byte[] { 1, 2, 3 }, "image/png")], Effort.Low);
        _content = _payload["messages"]![0]!["content"]!.AsArray();
    }

    [Fact] void should_have_an_image_block_and_a_text_block() => _content.Count.ShouldEqual(2);
    [Fact] void should_lead_with_the_image() => _content[0]!["type"]!.GetValue<string>().ShouldEqual("image");
    [Fact] void should_send_the_image_as_base64() => _content[0]!["source"]!["type"]!.GetValue<string>().ShouldEqual("base64");
    [Fact] void should_carry_the_media_type() => _content[0]!["source"]!["media_type"]!.GetValue<string>().ShouldEqual("image/png");
    [Fact] void should_carry_the_encoded_data() => _content[0]!["source"]!["data"]!.GetValue<string>().ShouldEqual(Convert.ToBase64String(new byte[] { 1, 2, 3 }));
    [Fact] void should_follow_with_the_prompt_text() => _content[1]!["text"]!.GetValue<string>().ShouldEqual("prompt");
}

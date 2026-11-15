// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_listing_models : given.a_proxy_in_front_of_a_backend
{
    JsonElement _openAI;
    JsonElement _anthropic;

    async Task Because()
    {
        var openAI = new HttpRequestMessage(HttpMethod.Get, "/ai/v1/models");
        openAI.Headers.TryAddWithoutValidation("Authorization", $"Bearer {CallerSecret}");
        _openAI = Parse(await (await _client.SendAsync(openAI)).Content.ReadAsStringAsync());

        var anthropic = new HttpRequestMessage(HttpMethod.Get, "/ai/v1/models");
        anthropic.Headers.TryAddWithoutValidation("x-api-key", CallerSecret);
        anthropic.Headers.TryAddWithoutValidation("anthropic-version", "2023-06-01");
        _anthropic = Parse(await (await _client.SendAsync(anthropic)).Content.ReadAsStringAsync());
    }

    [Fact] void should_list_the_model_in_the_openai_shape() => _openAI.GetProperty("data")[0].GetProperty("id").GetString().ShouldEqual("llama3");
    [Fact] void should_say_it_is_a_list() => _openAI.GetProperty("object").GetString().ShouldEqual("list");
    [Fact] void should_list_the_model_in_the_anthropic_shape() => _anthropic.GetProperty("data")[0].GetProperty("type").GetString().ShouldEqual("model");
    [Fact] void should_use_the_display_name_for_the_anthropic_caller() => _anthropic.GetProperty("data")[0].GetProperty("display_name").GetString().ShouldEqual("Llama 3");
}

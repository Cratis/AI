// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_the_model_is_not_served : given.a_proxy_in_front_of_a_backend
{
    HttpResponseMessage _openAI;
    HttpResponseMessage _anthropic;
    JsonElement _openAIBody;
    JsonElement _anthropicBody;

    async Task Because()
    {
        _openAI = await _client.SendAsync(Post("/ai/v1/chat/completions", """{"model":"gpt-nothing"}"""));
        _openAIBody = Parse(await _openAI.Content.ReadAsStringAsync());
        _anthropic = await _client.SendAsync(Post("/ai/v1/messages", """{"model":"claude-nothing"}""", true, ("anthropic-version", "2023-06-01")));
        _anthropicBody = Parse(await _anthropic.Content.ReadAsStringAsync());
    }

    [Fact] void should_answer_not_found_to_the_openai_caller() => _openAI.StatusCode.ShouldEqual(System.Net.HttpStatusCode.NotFound);
    [Fact] void should_use_the_openai_error_shape() => _openAIBody.GetProperty("error").GetProperty("message").GetString().ShouldContain("gpt-nothing");
    [Fact] void should_answer_not_found_to_the_anthropic_caller() => _anthropic.StatusCode.ShouldEqual(System.Net.HttpStatusCode.NotFound);
    [Fact] void should_use_the_anthropic_error_shape() => _anthropicBody.GetProperty("type").GetString().ShouldEqual("error");
    [Fact] void should_reach_no_backend() => _received.ShouldBeEmpty();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json.Nodes;
using Cratis.AI.LanguageModels;
using Cratis.AI.Usage;

namespace Cratis.AI.Providers.ZAI.for_ZAIProviderClient.when_completing_with_a_configured_endpoint;

public class the_completion : given.a_client_with_a_stubbed_endpoint
{
    LanguageModelResult _result;

    async Task Because() => _result = await PerformCompletion();

    [Fact] void should_post_to_the_configured_endpoint_messages_route() => _request.RequestUri!.ToString().ShouldEqual("https://z.example/api/anthropic/v1/messages");
    [Fact] void should_authenticate_the_key_as_a_bearer_token() => _request.Headers.Authorization!.Scheme.ShouldEqual("Bearer");
    [Fact] void should_send_the_key_in_the_bearer_token() => _request.Headers.Authorization!.Parameter.ShouldEqual("a-zai-key");
    [Fact] void should_not_send_the_anthropic_api_key_header() => _request.Headers.Contains("x-api-key").ShouldBeFalse();
    [Fact] void should_send_the_anthropic_version_header() => _request.Headers.GetValues("anthropic-version").Single().ShouldEqual("2023-06-01");
    [Fact] void should_ask_for_the_configured_model() => JsonNode.Parse(_requestBody)!["model"]!.GetValue<string>().ShouldEqual("glm-5.2");
    [Fact] void should_succeed() => _result.Succeeded.ShouldBeTrue();
    [Fact] void should_return_the_text() => _result.Text.ShouldEqual("Hello!");
    [Fact] void should_return_the_reported_usage() => _result.Usage!.InputTokens.ShouldEqual(new InputTokens(12));
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_calling_with_the_anthropic_protocol : given.a_proxy_in_front_of_a_backend
{
    HttpResponseMessage _response;

    async Task Because()
    {
        var request = Post("/ai/v1/messages", """{"model":"llama3","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}""", true, ("anthropic-version", "2023-06-01"));
        request.Headers.Remove("Authorization");
        request.Headers.TryAddWithoutValidation("x-api-key", CallerSecret);
        _response = await _client.SendAsync(request);
    }

    [Fact] void should_succeed() => _response.IsSuccessStatusCode.ShouldBeTrue();
    [Fact] void should_reach_the_backends_messages_path() => _received.Single().Path.ShouldEqual("/v1/messages");
    [Fact] void should_authenticate_to_the_backend_with_the_anthropic_header() => _received.Single().Headers["x-api-key"].ShouldEqual(BackendKey);
    [Fact] void should_not_send_a_bearer_credential() => _received.Single().Headers.ContainsKey("Authorization").ShouldBeFalse();
    [Fact] void should_keep_the_version_the_caller_named() => _received.Single().Headers["anthropic-version"].ShouldEqual("2023-06-01");
}

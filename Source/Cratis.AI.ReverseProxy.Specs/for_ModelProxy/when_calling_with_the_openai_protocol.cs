// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_calling_with_the_openai_protocol : given.a_proxy_in_front_of_a_backend
{
    HttpResponseMessage _response;
    string _body;

    async Task Because()
    {
        _response = await _client.SendAsync(Post("/ai/v1/chat/completions", """{"model":"llama3","messages":[{"role":"user","content":"hi"}]}"""));
        _body = await _response.Content.ReadAsStringAsync();
    }

    [Fact] void should_succeed() => _response.IsSuccessStatusCode.ShouldBeTrue();
    [Fact] void should_return_the_backends_answer() => _body.ShouldContain("hello from the backend");
    [Fact] void should_reach_the_backend_once() => _received.Count.ShouldEqual(1);
    [Fact] void should_deliver_the_request_body_unchanged() => _received.Single().Body.ShouldContain("\"model\":\"llama3\"");
    [Fact] void should_ask_for_the_path_below_the_prefix() => _received.Single().Path.ShouldEqual("/v1/chat/completions");
    [Fact] void should_authenticate_to_the_backend_as_the_endpoint() => _received.Single().Headers["Authorization"].ShouldEqual($"Bearer {BackendKey}");
}

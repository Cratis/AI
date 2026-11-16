// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_pinning_an_endpoint : given.a_proxy_in_front_of_a_backend
{
    HttpResponseMessage _response;
    HttpResponseMessage _unknown;

    async Task Because()
    {
        _response = await _client.SendAsync(Post("/ai/endpoints/workstation/v1/chat/completions", """{"model":"anything-the-backend-knows"}"""));
        _unknown = await _client.SendAsync(Post("/ai/endpoints/nowhere/v1/chat/completions", """{"model":"llama3"}"""));
    }

    [Fact] void should_send_it_to_that_endpoint_whatever_the_model() => _response.IsSuccessStatusCode.ShouldBeTrue();
    [Fact] void should_strip_the_pinning_from_the_path_the_backend_sees() => _received.Single().Path.ShouldEqual("/v1/chat/completions");
    [Fact] void should_refuse_an_endpoint_that_does_not_exist() => _unknown.StatusCode.ShouldEqual(System.Net.HttpStatusCode.NotFound);
}

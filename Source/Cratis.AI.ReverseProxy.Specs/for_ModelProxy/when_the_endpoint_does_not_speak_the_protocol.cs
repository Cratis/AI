// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Protocols;

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_the_endpoint_does_not_speak_the_protocol : given.a_proxy_in_front_of_a_backend
{
    HttpResponseMessage _response;

    async Task Because()
    {
        _endpoints.Set(new("openai-only", "OpenAI only", BackendAddress, AIProtocol.OpenAI, [new("phi")]));
        _response = await _client.SendAsync(Post("/ai/endpoints/openai-only/v1/messages", """{"model":"phi"}""", true, ("anthropic-version", "2023-06-01")));
    }

    [Fact] void should_refuse_it() => _response.StatusCode.ShouldEqual(System.Net.HttpStatusCode.BadRequest);
    [Fact] void should_reach_no_backend() => _received.ShouldBeEmpty();
}

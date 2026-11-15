// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Protocols;

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_an_endpoint_connects_while_running : given.a_proxy_in_front_of_a_backend
{
    HttpResponseMessage _before;
    HttpResponseMessage _after;
    HttpResponseMessage _removed;

    async Task Because()
    {
        _before = await _client.SendAsync(Post("/ai/v1/chat/completions", """{"model":"qwen"}"""));
        _endpoints.Set(new("laptop", "Laptop", BackendAddress, AIProtocol.OpenAI, [new("qwen")]));
        _after = await RetryUntilRouted(() => Post("/ai/v1/chat/completions", """{"model":"qwen"}"""));
        _endpoints.Remove("laptop");
        _removed = await _client.SendAsync(Post("/ai/v1/chat/completions", """{"model":"qwen"}"""));
    }

    async Task<HttpResponseMessage> RetryUntilRouted(Func<HttpRequestMessage> request)
    {
        // YARP applies a configuration change asynchronously; the proxy answers 503 until its cluster exists.
        HttpResponseMessage response = new(System.Net.HttpStatusCode.ServiceUnavailable);
        for (var attempt = 0; attempt < 50; attempt++)
        {
            response = await _client.SendAsync(request());
            if (response.IsSuccessStatusCode)
            {
                break;
            }

            await Task.Delay(100);
        }

        return response;
    }

    [Fact] void should_not_serve_the_model_before() => _before.StatusCode.ShouldEqual(System.Net.HttpStatusCode.NotFound);
    [Fact] void should_serve_the_model_once_the_endpoint_is_there() => _after.IsSuccessStatusCode.ShouldBeTrue();
    [Fact] void should_stop_serving_it_once_the_endpoint_is_gone() => _removed.StatusCode.ShouldEqual(System.Net.HttpStatusCode.NotFound);
}

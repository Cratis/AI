// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_asking_for_a_path_no_protocol_owns : given.a_proxy_in_front_of_a_backend
{
    HttpResponseMessage _pull;
    HttpResponseMessage _pinnedPull;

    async Task Because()
    {
        _pull = await _client.SendAsync(Post("/ai/api/pull", """{"model":"llama3"}"""));
        _pinnedPull = await _client.SendAsync(Post("/ai/endpoints/workstation/api/pull", """{"name":"llama3"}"""));
    }

    [Fact] void should_refuse_a_backend_management_path() => _pull.StatusCode.ShouldEqual(System.Net.HttpStatusCode.NotFound);
    [Fact] void should_refuse_it_when_the_endpoint_is_pinned() => _pinnedPull.StatusCode.ShouldEqual(System.Net.HttpStatusCode.NotFound);
    [Fact] void should_reach_no_backend() => _received.ShouldBeEmpty();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_the_caller_is_not_allowed : given.a_proxy_in_front_of_a_backend
{
    HttpResponseMessage _completion;
    HttpResponseMessage _listing;

    async Task Because()
    {
        _completion = await _client.SendAsync(Post("/ai/v1/chat/completions", """{"model":"llama3"}""", withCredential: false));
        _listing = await _client.GetAsync("/ai/v1/models");
    }

    [Fact] void should_refuse_the_completion() => _completion.StatusCode.ShouldEqual(System.Net.HttpStatusCode.Unauthorized);
    [Fact] void should_refuse_the_listing() => _listing.StatusCode.ShouldEqual(System.Net.HttpStatusCode.Unauthorized);
    [Fact] void should_reach_no_backend() => _received.ShouldBeEmpty();
}

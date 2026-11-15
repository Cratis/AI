// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.for_ModelProxy;

public class when_the_caller_presents_a_credential : given.a_proxy_in_front_of_a_backend
{
    async Task Because() => await _client.SendAsync(Post("/ai/v1/chat/completions", """{"model":"llama3"}""", true, ("Cookie", "session=abc"), ("X-Forwarded-For", "10.0.0.7"), ("x-ms-client-principal", "e30=")));

    [Fact] void should_never_forward_the_callers_credential() => _received.Single().Headers.Values.ShouldNotContain(value => value.Contains(CallerSecret));
    [Fact] void should_never_forward_cookies() => _received.Single().Headers.ContainsKey("Cookie").ShouldBeFalse();
    [Fact] void should_never_forward_the_forwarded_identity() => _received.Single().Headers.ContainsKey("x-ms-client-principal").ShouldBeFalse();
}

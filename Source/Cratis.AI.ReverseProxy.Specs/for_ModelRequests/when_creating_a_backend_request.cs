// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;
using Cratis.AI.ReverseProxy.Protocols;

namespace Cratis.AI.ReverseProxy.Transport.for_ModelRequests;

public class when_creating_a_backend_request : Specification
{
    HttpRequestMessage _openAI;
    HttpRequestMessage _anthropic;
    HttpRequestMessage _open;

    void Because()
    {
        IEnumerable<KeyValuePair<string, IEnumerable<string>>> headers =
        [
            new("Authorization", ["Bearer caller"]),
            new("x-api-key", ["caller"]),
            new("Cookie", ["a=b"]),
            new("X-Trace", ["abc"])
        ];
        var endpoint = new ModelEndpoint("host", "Host", "http://host:1/v1", AIProtocol.OpenAI | AIProtocol.Anthropic, [], "backend");
        _openAI = ModelRequests.Create(endpoint, HttpMethod.Post, "/v1/chat/completions", headers, null);
        _anthropic = ModelRequests.Create(endpoint, HttpMethod.Post, "/v1/messages", headers, null);
        _open = ModelRequests.Create(endpoint with { ApiKey = string.Empty }, HttpMethod.Post, "/v1/chat/completions", headers, null);
    }

    [Fact] void should_append_the_path_to_the_normalized_base() => _openAI.RequestUri.ToString().ShouldEqual("http://host:1/v1/chat/completions");
    [Fact] void should_use_a_bearer_credential_for_openai() => _openAI.Headers.GetValues("Authorization").Single().ShouldEqual("Bearer backend");
    [Fact] void should_use_the_api_key_header_for_anthropic() => _anthropic.Headers.GetValues("x-api-key").Single().ShouldEqual("backend");
    [Fact] void should_not_send_a_bearer_credential_for_anthropic() => _anthropic.Headers.Contains("Authorization").ShouldBeFalse();
    [Fact] void should_send_no_credential_when_the_endpoint_has_none() => _open.Headers.Contains("Authorization").ShouldBeFalse();
    [Fact] void should_drop_cookies() => _openAI.Headers.Contains("Cookie").ShouldBeFalse();
    [Fact] void should_keep_ordinary_headers() => _openAI.Headers.GetValues("X-Trace").Single().ShouldEqual("abc");
}

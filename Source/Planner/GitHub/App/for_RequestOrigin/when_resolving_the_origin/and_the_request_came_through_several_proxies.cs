// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.AspNetCore.Http;

namespace Planner.GitHub.App.for_RequestOrigin.when_resolving_the_origin;

public class and_the_request_came_through_several_proxies : Specification
{
    HttpRequest _request;
    string _result;

    void Establish()
    {
        _request = new DefaultHttpContext().Request;
        _request.Scheme = "http";
        _request.Host = new HostString("planner");
        _request.Headers[RequestOrigin.ForwardedProtoHeader] = "https, http";
        _request.Headers[RequestOrigin.ForwardedHostHeader] = "planner.cratis.io, ingress.internal";
    }

    void Because() => _result = RequestOrigin.From(_request);

    [Fact]
    void should_use_the_first_hop_which_is_the_one_facing_the_client() =>
        _result.ShouldEqual("https://planner.cratis.io");
}
#endif

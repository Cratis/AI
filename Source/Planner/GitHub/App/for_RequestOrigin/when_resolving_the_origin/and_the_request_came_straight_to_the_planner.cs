// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Microsoft.AspNetCore.Http;

namespace Planner.GitHub.App.for_RequestOrigin.when_resolving_the_origin;

public class and_the_request_came_straight_to_the_planner : Specification
{
    HttpRequest _request;
    string _result;

    void Establish()
    {
        _request = new DefaultHttpContext().Request;
        _request.Scheme = "http";
        _request.Host = new HostString("localhost", 5200);
    }

    void Because() => _result = RequestOrigin.From(_request);

    [Fact]
    void should_use_the_requests_own_scheme_and_host() => _result.ShouldEqual("http://localhost:5200");
}
#endif

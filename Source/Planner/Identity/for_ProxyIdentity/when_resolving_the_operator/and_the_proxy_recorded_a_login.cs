// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Planner.Identity.for_ProxyIdentity.when_resolving_the_operator;

public class and_the_proxy_recorded_a_login : Specification
{
    HttpRequest _request;
    ClaimsPrincipal _result;

    void Establish()
    {
        _request = new DefaultHttpContext().Request;

        // Several proxies in front of each other append one entry per hop, oldest first - the
        // client-facing one is the first.
        _request.Headers["X-Auth-Request-User"] = "einari, gateway";
    }

    void Because() => _result = ProxyIdentity.Resolve(
        _request,
        new SecurityOptions { ForwardedUserHeader = "X-Auth-Request-User" })!;

    [Fact] void should_recognize_an_operator() => _result.Identity!.IsAuthenticated.ShouldBeTrue();
    [Fact] void should_take_the_login_the_client_reached_the_proxy_as() => _result.FindFirst(ProxyIdentity.LoginClaimType)!.Value.ShouldEqual("einari");
    [Fact] void should_record_where_the_identity_came_from() => _result.Identity!.AuthenticationType.ShouldEqual(ProxyIdentity.ProxyAuthenticationType);
}
#endif

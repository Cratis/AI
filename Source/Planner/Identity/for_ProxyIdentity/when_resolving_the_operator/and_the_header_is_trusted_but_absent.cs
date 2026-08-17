// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Planner.Identity.for_ProxyIdentity.when_resolving_the_operator;

/// <summary>
/// A request that reached the Planner without passing the proxy - a worker callback from inside the
/// cluster, or anything that slipped past the ingress - is not an operator.
/// </summary>
public class and_the_header_is_trusted_but_absent : Specification
{
    HttpRequest _request;
    ClaimsPrincipal _result;

    void Establish() => _request = new DefaultHttpContext().Request;

    void Because() => _result = ProxyIdentity.Resolve(
        _request,
        new SecurityOptions { ForwardedUserHeader = "X-Forwarded-User" })!;

    [Fact]
    void should_recognize_no_operator() => _result.ShouldBeNull();
}
#endif

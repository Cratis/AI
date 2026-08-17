// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Planner.Identity.for_ProxyIdentity.when_resolving_the_operator;

/// <summary>
/// An unconfigured deployment trusts nobody - not even a caller that helpfully sends the header a
/// configured deployment would read.
/// </summary>
public class and_nothing_is_configured : Specification
{
    HttpRequest _request;
    ClaimsPrincipal _result;

    void Establish()
    {
        _request = new DefaultHttpContext().Request;
        _request.Headers["X-Forwarded-User"] = "einari";
    }

    void Because() => _result = ProxyIdentity.Resolve(_request, new SecurityOptions())!;

    [Fact]
    void should_recognize_no_operator() => _result.ShouldBeNull();
}
#endif

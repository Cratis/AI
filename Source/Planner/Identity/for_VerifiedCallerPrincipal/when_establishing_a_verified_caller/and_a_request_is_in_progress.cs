// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Cratis.Arc.AspNetCore.Http;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;

namespace Planner.Identity.for_VerifiedCallerPrincipal.when_establishing_a_verified_caller;

public class and_a_request_is_in_progress : Specification
{
    HttpContext _httpContext;
    ClaimsPrincipal? _current;

    void Establish() => _httpContext = new DefaultHttpContext();

    // The accessor's storage is AsyncLocal, and Cratis.Specifications invokes Establish, Because, and
    // each [Fact] as separate continuations that do not reliably share one AsyncLocal flow - so both
    // constructing the accessor (simulating what Arc's HttpRequestContextMiddleware does for every real
    // request) and reading it back happen together, here.
    void Because()
    {
        var requestContextAccessor = new HttpRequestContextAccessor { Current = new AspNetCoreHttpRequestContext(_httpContext) };
        var principalAccessor = new CurrentPrincipalAccessor(requestContextAccessor);

        _httpContext.EstablishAsVerified();
        _current = principalAccessor.Current;
    }

    [Fact] void should_be_authenticated() => _current!.Identity!.IsAuthenticated.ShouldBeTrue();
    [Fact] void should_be_the_system_principal() => _current!.Identity!.AuthenticationType.ShouldEqual(SystemPrincipal.AuthenticationType);
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Cratis.Arc.AspNetCore.Http;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;

namespace Planner.Identity.for_VerifiedCallerPrincipal.when_establishing_a_verified_caller;

/// <summary>
/// Proves the documented trap <see cref="VerifiedCallerPrincipal"/> exists to work around: an
/// <see cref="ISystemExecution"/> scope is silently ignored while an HTTP request is in progress, so it
/// is the wrong mechanism for a webhook or worker-callback handler.
/// </summary>
public class and_system_execution_is_attempted_instead : Specification
{
    HttpContext _httpContext;
    ClaimsPrincipal? _current;

    void Establish() => _httpContext = new DefaultHttpContext();

    // Building the accessor and reading it back both happen here - see and_a_request_is_in_progress
    // for why: the accessor's storage is AsyncLocal, and a value set in Establish is not reliably
    // visible in Because under Cratis.Specifications.
    void Because()
    {
        var requestContextAccessor = new HttpRequestContextAccessor { Current = new AspNetCoreHttpRequestContext(_httpContext) };
        var principalAccessor = new CurrentPrincipalAccessor(requestContextAccessor);

        using var scope = new SystemExecution(principalAccessor).AsSystem();
        _current = principalAccessor.Current;
    }

    [Fact] void should_leave_the_request_principal_untouched() => _current.ShouldEqual(_httpContext.User);
    [Fact] void should_not_be_authenticated() => _current!.Identity!.IsAuthenticated.ShouldBeFalse();
}
#endif

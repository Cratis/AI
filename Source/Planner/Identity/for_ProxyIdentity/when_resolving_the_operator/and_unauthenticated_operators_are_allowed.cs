// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace Planner.Identity.for_ProxyIdentity.when_resolving_the_operator;

/// <summary>
/// The developer-machine escape hatch: no proxy, so every caller is the local operator. It has to be
/// switched on deliberately, which is why the default configuration does not.
/// </summary>
public class and_unauthenticated_operators_are_allowed : Specification
{
    HttpRequest _request;
    ClaimsPrincipal _result;

    void Establish() => _request = new DefaultHttpContext().Request;

    void Because() => _result = ProxyIdentity.Resolve(
        _request,
        new SecurityOptions { AllowUnauthenticatedOperators = true })!;

    [Fact] void should_recognize_an_operator() => _result.Identity!.IsAuthenticated.ShouldBeTrue();
    [Fact] void should_name_them_as_local() => _result.FindFirst(ProxyIdentity.LoginClaimType)!.Value.ShouldEqual(ProxyIdentity.LocalOperator);
    [Fact] void should_record_that_nobody_authenticated_them() => _result.Identity!.AuthenticationType.ShouldEqual(ProxyIdentity.LocalAuthenticationType);
}
#endif

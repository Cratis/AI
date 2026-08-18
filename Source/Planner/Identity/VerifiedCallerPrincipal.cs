// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;

namespace Planner.Identity;

/// <summary>
/// Establishes the trusted principal a boundary endpoint executes a command as, once the endpoint's own
/// credential check has verified the caller.
/// </summary>
/// <remarks>
/// A GitHub/alert webhook (an HMAC-signed delivery) and the worker callback (a per-work bearer token)
/// each authenticate their caller independently of Arc, outside its authorization pipeline entirely -
/// there is no <see cref="System.Security.Claims.ClaimsPrincipal"/> for Arc to read until the handler
/// puts one there.
/// <para>
/// <see cref="ISystemExecution.AsSystem"/> and <see cref="ISystemExecution.As"/> cannot be used for this:
/// both establish a principal through <see cref="ICurrentPrincipalOverride"/>, which is a documented
/// no-op whenever an HTTP request is in progress - Arc's authorization always reads the request principal
/// instead, precisely so a server-side scope can never widen an HTTP-origin command's authorization. A
/// webhook or callback handler <b>is</b> an HTTP request, so that mechanism silently does nothing there.
/// </para>
/// <para>
/// Setting <see cref="HttpContext.User"/> directly - the same thing <c>ProxyIdentity</c> and
/// <c>UsePlannerSecurity</c> do to turn a proxy-authenticated request into a principal - is what Arc's
/// authorization actually reads for the remainder of a request already in progress.
/// </para>
/// </remarks>
public static class VerifiedCallerPrincipal
{
    /// <summary>
    /// Marks the current request as executing as a trusted, independently-verified caller.
    /// </summary>
    /// <param name="httpContext">The <see cref="HttpContext"/> of the request whose credential check already succeeded.</param>
    /// <param name="roles">The roles the caller holds, for a command that carries <see cref="RolesAttribute"/>. Empty satisfies a bare <see cref="AuthorizeAttribute"/>.</param>
    /// <remarks>
    /// Call this only after the endpoint's own signature/token check has succeeded - it exists to carry
    /// that verdict into Arc's authorization, not to replace the check itself.
    /// </remarks>
    public static void EstablishAsVerified(this HttpContext httpContext, params string[] roles) =>
        httpContext.User = SystemPrincipal.WithRoles(roles);
}

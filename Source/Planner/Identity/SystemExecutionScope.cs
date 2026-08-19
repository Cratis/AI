// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using System.Security.Claims;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;

namespace Planner.Identity;

/// <summary>
/// Enters an Arc system-execution scope, so a spec can drive a command carrying
/// <see cref="AuthorizeAttribute"/> through the real command pipeline.
/// </summary>
/// <remarks>
/// Arc's authorization reads the principal off the current HTTP request, and a spec has none - so an
/// authorized command is refused unless the spec says who it runs as. This is the same mechanism the
/// production reactors use to schedule work as a trusted system actor; it only ever applies when
/// there is no HTTP request, so it can never widen an HTTP-origin command's authorization.
/// </remarks>
internal static class SystemExecutionScope
{
    /// <summary>
    /// Enters a scope that executes as a trusted system actor.
    /// </summary>
    /// <returns>An <see cref="IDisposable"/> that leaves the scope when disposed.</returns>
    internal static IDisposable Enter() =>
        new SystemExecution(new CurrentPrincipalAccessor(new NoHttpRequest())).AsSystem();

    /// <summary>
    /// Enters a scope that executes as the given principal - for a spec proving an
    /// <see cref="AuthorizeAttribute"/> command succeeds for a real, non-system operator, distinct from
    /// the trusted-system-actor path <see cref="Enter()"/> exercises.
    /// </summary>
    /// <param name="principal">The <see cref="ClaimsPrincipal"/> to execute as.</param>
    /// <returns>An <see cref="IDisposable"/> that leaves the scope when disposed.</returns>
    internal static IDisposable Enter(ClaimsPrincipal principal) =>
        new SystemExecution(new CurrentPrincipalAccessor(new NoHttpRequest())).As(principal);

    /// <summary>
    /// A real <see cref="ISystemExecution"/> for a reactor spec to register, rather than a substitute.
    /// </summary>
    /// <returns>The <see cref="ISystemExecution"/> to register into the scenario's services.</returns>
    /// <remarks>
    /// A substitute would return <see langword="null"/> from <see cref="ISystemExecution.AsSystem"/> and
    /// make every <c>using var scope = systemExecution.AsSystem()</c> in the reactor a no-op, so the spec
    /// would pass whether or not the reactor actually established a principal - which is precisely the
    /// thing worth proving. The real one, over an accessor reporting no HTTP request, enters the same
    /// scope production does when a reactor runs off a timer or an event.
    /// </remarks>
    internal static ISystemExecution ForSpecs() =>
        new SystemExecution(new CurrentPrincipalAccessor(new NoHttpRequest()));

    /// <summary>
    /// An <see cref="IHttpRequestContextAccessor"/> reporting no HTTP request in progress - for a spec
    /// that needs to read the ambient principal the same way Arc's own authorization would.
    /// </summary>
    /// <returns>The accessor.</returns>
    internal static IHttpRequestContextAccessor NoRequestContextAccessor() => new NoHttpRequest();

    sealed class NoHttpRequest : IHttpRequestContextAccessor
    {
        public IHttpRequestContext? Current { get; set; }
    }
}
#endif

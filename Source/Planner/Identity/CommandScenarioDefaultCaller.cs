// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;

namespace Planner.Identity;

/// <summary>
/// Establishes a default authenticated caller for every <see cref="CommandScenario{TCommand}"/>, so an
/// existing command spec that never mentions authorization keeps testing the behavior it was written for
/// - valid input succeeds - rather than every one of them needing to establish a principal for a concern
/// (who is calling) that is orthogonal to what it verifies. Authorization itself is still exercised, on
/// its own terms, by the specs in <c>Identity/for_DenyByDefaultAuthorization</c>.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="CommandScenario{TCommand}"/> discovers every <see cref="ICommandScenarioExtender"/> in the
/// process at construction time and calls <see cref="Extend"/> before the scenario builds its service
/// provider - the one hook a scenario exposes that runs early enough to matter here.
/// </para>
/// <para>
/// A scope entered around <c>Because()</c> (<c>SystemExecutionScope</c>, <c>ISystemExecution.AsSystem()</c>)
/// cannot do this job: both rely on an <c>AsyncLocal</c> override, and <c>Cratis.Specifications</c> invokes
/// <c>Establish</c>/<c>Because</c>/each <c>[Fact]</c> as separate continuations that do not reliably share
/// one <c>AsyncLocal</c> flow - verified directly, not assumed: a scope entered in <c>Establish</c> and
/// left open across into <c>Because</c> does not survive the boundary. Overriding
/// <see cref="ICurrentPrincipalAccessor"/>/<see cref="ICurrentPrincipalOverride"/> from here does not work
/// either - <c>AddCratisArcCore</c> registers a concrete <c>CurrentPrincipalAccessor</c> for both
/// unconditionally, and a later plain <c>AddSingleton</c> for the same service type always wins over an
/// earlier one, so anything registered here would just be shadowed.
/// </para>
/// <para>
/// <see cref="IHttpRequestContextAccessor"/> is different: <c>AddCratisArcCore</c> never registers it
/// directly - it relies entirely on Cratis's generic <c>IFoo -&gt; Foo</c> naming-convention binding, which
/// explicitly skips a service type that is already registered. Pre-registering it here therefore sticks,
/// and <see cref="CurrentPrincipalAccessor"/> (Arc's real one, wired into the real
/// <see cref="IAuthorizationEvaluator"/> exactly as in production) reads the principal on this fake
/// request's <see cref="IHttpRequestContext.User"/> for the whole scenario - a plain, non-<c>AsyncLocal</c>
/// object graph, so it works regardless of which lifecycle method touches it.
/// </para>
/// <para>
/// Nothing in command execution reads any other member of <see cref="IHttpRequestContext"/> (tenancy
/// resolvers do, but they run only for the identity-details endpoint, never for a command), so leaving
/// every other member unconfigured on the substitute is safe.
/// </para>
/// <para>
/// A spec that means to exercise "no principal at all" overrides this after construction, before the
/// first <c>Execute</c>/<c>Validate</c> call, with <see cref="NoRequestContext"/> -
/// <c>_scenario.Services.AddSingleton(CommandScenarioDefaultCaller.NoRequestContext());</c> - the same
/// override pattern documented for every other <see cref="CommandScenario{TCommand}"/> dependency; a
/// later registration for the same service type wins. A bare, unconfigured
/// <c>Substitute.For&lt;IHttpRequestContextAccessor&gt;()</c> does <b>not</b> do this on its own: NSubstitute
/// auto-generates a non-null child substitute for an unconfigured member whose return type is itself an
/// interface, so <c>.Current</c> comes back non-null and <see cref="CurrentPrincipalAccessor"/> still
/// takes the "request in progress" branch instead of falling through to an <c>AsyncLocal</c> override -
/// <c>.Current</c> must be configured to return <see langword="null"/> explicitly.
/// </para>
/// </remarks>
public class CommandScenarioDefaultCaller : ICommandScenarioExtender
{
    /// <summary>
    /// Builds an <see cref="IHttpRequestContextAccessor"/> that reports no request in progress at all -
    /// for a spec that overrides the default caller established by <see cref="Extend"/> to instead prove
    /// a genuinely unauthenticated or system-scoped path.
    /// </summary>
    /// <returns>The <see cref="IHttpRequestContextAccessor"/> to register into <c>CommandScenario.Services</c>.</returns>
    public static IHttpRequestContextAccessor NoRequestContext()
    {
        var requestContextAccessor = Substitute.For<IHttpRequestContextAccessor>();
        requestContextAccessor.Current.Returns((IHttpRequestContext?)null);
        return requestContextAccessor;
    }

    /// <inheritdoc/>
    public void Extend(IServiceCollection services, IDictionary<string, object> context)
    {
        var requestContext = Substitute.For<IHttpRequestContext>();
        requestContext.User.Returns(SystemPrincipal.WithRoles());

        var requestContextAccessor = Substitute.For<IHttpRequestContextAccessor>();
        requestContextAccessor.Current.Returns(requestContext);

        services.AddSingleton(requestContextAccessor);
    }
}
#endif

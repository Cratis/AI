// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Reflection;
using Cratis.Arc.Authorization;

namespace Planner.Identity;

/// <summary>
/// Flips Arc's authorization default from allow to deny for every command and query the Planner exposes.
/// </summary>
/// <remarks>
/// <para>
/// Arc asks every discovered <see cref="IAuthorizationAttributeEvaluator"/> in turn and commits to the
/// first one that reports an opinion; an artifact none of them have an opinion on is treated as public.
/// The Planner exposes agent automation holding a GitHub App token and, on the alert-investigation path,
/// the production kubeconfig, Docker socket and a Grafana token - "public unless someone remembered to
/// attribute it" is the wrong default for that surface.
/// </para>
/// <para>
/// This evaluator is discovered the same way Arc's own built-in evaluator is: through
/// <c>IInstancesOf&lt;IAuthorizationAttributeEvaluator&gt;</c>, which finds every concrete implementation
/// in the process by reflection and resolves each one from the container by its own concrete type - not
/// through an explicit interface registration. No wiring in <c>Program.cs</c> is needed for it to take
/// effect, and none was added; the seven production commands that already relied on this exact mechanism
/// for their own <see cref="AuthorizeAttribute"/> before this class existed are the proof it works.
/// </para>
/// <para>
/// It never overrides a real <see cref="AuthorizeAttribute"/> (or the <see cref="RolesAttribute"/> that
/// derives from it): whenever one is present - on the member itself, or on its declaring type - this
/// evaluator returns <see langword="null"/> ("no opinion") so Arc's own evaluator, not this one, is the
/// one that reports the roles. Reporting "requires authorization, no specific role" here regardless of a
/// real attribute would risk winning the race against Arc's evaluator (the order
/// <c>IInstancesOf&lt;T&gt;</c> enumerates implementations in is unspecified) and silently dropping a
/// <see cref="RolesAttribute"/> restriction down to "any authenticated caller can call this". The same
/// reasoning applies one level down, at the method: a query method with no attribute of its own, whose
/// declaring read-model type carries one, must also defer - reporting an opinion at the method level
/// would stop Arc's method-then-declaring-type fallback from ever reaching the type, silently dropping
/// its roles the same way. See <see cref="GetAuthorizationInfo(MethodInfo)"/>.
/// </para>
/// </remarks>
public class DenyByDefaultAuthorization : IAuthorizationAttributeEvaluator
{
    /// <inheritdoc/>
    public (bool HasAuthorize, string? Roles)? GetAuthorizationInfo(Type type) =>
        HasRealAuthorizeAttribute(type) ? null : (true, null);

    /// <inheritdoc/>
    /// <remarks>
    /// Defers whenever the method itself, or its declaring type, carries a real <see cref="AuthorizeAttribute"/>
    /// - see the class remarks for why reporting an opinion in either of those cases would mask the real
    /// attribute's roles instead of just leaving it in place.
    /// </remarks>
    public (bool HasAuthorize, string? Roles)? GetAuthorizationInfo(MethodInfo method)
    {
        if (HasRealAuthorizeAttribute(method))
        {
            return null;
        }

        if (method.DeclaringType is { } declaringType && HasRealAuthorizeAttribute(declaringType))
        {
            return null;
        }

        return (true, null);
    }

    static bool HasRealAuthorizeAttribute(MemberInfo member) =>
        member.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true).OfType<AuthorizeAttribute>().Any();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace Planner.Identity;

/// <summary>
/// Turns the identity an authenticating reverse proxy recorded on a request into the principal the
/// rest of the Planner authorizes against.
/// </summary>
/// <remarks>
/// <see cref="CurrentUser"/> and Arc's command authorization both read <c>HttpContext.User</c>, and
/// nothing in an ASP.NET pipeline populates it unless an authentication handler does. The Planner has
/// no identity provider of its own by design - the proxy in front of it is the authenticator - so
/// this is the one place its verdict is turned into a principal.
/// </remarks>
public static class ProxyIdentity
{
    /// <summary>
    /// The authentication type of a principal that came from the authenticating proxy.
    /// </summary>
    public const string ProxyAuthenticationType = "Proxy";

    /// <summary>
    /// The authentication type of the synthetic principal used when the Planner runs with no proxy
    /// in front of it.
    /// </summary>
    public const string LocalAuthenticationType = "Local";

    /// <summary>
    /// The login the synthetic local principal carries.
    /// </summary>
    public const string LocalOperator = "local";

    /// <summary>
    /// The claim type <see cref="CurrentUser"/> reads the login from first.
    /// </summary>
    public const string LoginClaimType = "preferred_username";

    /// <summary>
    /// Resolves the principal a request should execute as.
    /// </summary>
    /// <param name="request">The <see cref="HttpRequest"/> to resolve from.</param>
    /// <param name="options">The <see cref="SecurityOptions"/> saying who is trusted.</param>
    /// <returns>The resolved <see cref="ClaimsPrincipal"/>, or <see langword="null"/> when the request carries no trusted identity.</returns>
    public static ClaimsPrincipal? Resolve(HttpRequest request, SecurityOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.ForwardedUserHeader))
        {
            // A request that passed through several proxies carries one entry per hop, oldest first -
            // the client-facing one is the first, the same reading RequestOrigin does.
            var login = request.Headers[options.ForwardedUserHeader].ToString().Split(',')[0].Trim();
            if (!string.IsNullOrEmpty(login))
            {
                return PrincipalFor(login, ProxyAuthenticationType);
            }
        }

        return options.AllowUnauthenticatedOperators ? PrincipalFor(LocalOperator, LocalAuthenticationType) : null;
    }

    static ClaimsPrincipal PrincipalFor(string login, string authenticationType) =>
        new(new ClaimsIdentity(
            [new Claim(LoginClaimType, login), new Claim(ClaimTypes.Name, login)],
            authenticationType));
}

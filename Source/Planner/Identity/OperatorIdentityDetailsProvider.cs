// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Identity;

namespace Planner.Identity;

/// <summary>
/// The identity details Arc publishes to the frontend for the current operator.
/// </summary>
/// <param name="Login">
/// The operator's login. The Planner treats this as the operator's GitHub login - see
/// <see cref="OperatorIdentityDetailsProvider"/> for why that is a deployment assumption rather than
/// something verified here.
/// </param>
public record OperatorDetails(UserName Login);

/// <summary>
/// Provides the <see cref="OperatorDetails"/> Arc publishes at <c>GET /.cratis/me</c>.
/// </summary>
/// <remarks>
/// <para>
/// The Planner has no identity provider of its own by design - <see cref="ProxyIdentity"/> already
/// turned the authenticating proxy's verdict into the request principal, and <see cref="SecurityConfigurationExtensions.UsePlannerSecurity"/>
/// is the actual trust boundary: Arc only calls this provider once that middleware has already decided
/// the request carries an authenticated operator. <see cref="IdentityDetails.IsUserAuthorized"/> is
/// therefore always <see langword="true"/> here - there is no further gate to apply.
/// </para>
/// <para>
/// The login is surfaced unchanged as a <see cref="UserName"/> - the same "GitHub login" type
/// <see cref="CurrentUser"/> already returns. Nothing here or anywhere else in the Planner verifies that
/// the login the ingress authenticated is actually the operator's GitHub account: a deployment that lets
/// operators sign in as anything other than their GitHub login breaks GitHub-mention-based features (such
/// as a "mentions me" filter) silently rather than with an error, because the comparison simply never
/// matches. In <c>AllowUnauthenticatedOperators</c> development mode the login is the literal string
/// <c>"local"</c>, which is not a GitHub login either - mention-based matching against it always comes up
/// empty, which is the expected, harmless degradation for that mode.
/// </para>
/// </remarks>
public class OperatorIdentityDetailsProvider : IProvideIdentityDetails<OperatorDetails>
{
    /// <summary>
    /// Provides the <see cref="OperatorDetails"/> for the authenticated operator.
    /// </summary>
    /// <param name="context">The <see cref="IdentityProviderContext"/> describing who Arc authenticated.</param>
    /// <returns>The <see cref="IdentityDetails"/>, always authorized.</returns>
    public Task<IdentityDetails> Provide(IdentityProviderContext context)
    {
        var login = context.Claims.FirstOrDefault(claim => claim.Key == ProxyIdentity.LoginClaimType).Value;
        if (string.IsNullOrEmpty(login))
        {
            login = context.Name.Value;
        }

        return Task.FromResult(new IdentityDetails(true, new OperatorDetails(login)));
    }
}

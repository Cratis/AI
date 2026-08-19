// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Identity;

namespace Planner.Identity;

/// <summary>
/// The details the frontend gets about the signed-in user - just the GitHub login today, which is
/// what "For me" filtering, the inbox and replying as the user key off.
/// </summary>
/// <param name="Login">The GitHub login of the signed-in user - <see cref="UserName.NotSet"/> when nobody is signed in.</param>
public record PlannerUserDetails(UserName Login);

/// <summary>
/// The Planner's <see cref="IProvideIdentityDetails{TDetails}"/> - reshapes the claims the
/// authenticating proxy hands over into the GitHub login the rest of the Planner already works with
/// (the same claim types <see cref="CurrentUser"/> reads).
/// </summary>
public class PlannerIdentityDetailsProvider : IProvideIdentityDetails<PlannerUserDetails>
{
    static readonly string[] _claimTypes = ["preferred_username", "login", "name", System.Security.Claims.ClaimTypes.Name];

    /// <inheritdoc/>
    public Task<IdentityDetails> Provide(IdentityProviderContext context)
    {
        var claims = context.Claims.ToList();
        var login = _claimTypes
            .Select(claimType => claims.FirstOrDefault(claim => claim.Key == claimType).Value)
            .FirstOrDefault(value => !string.IsNullOrEmpty(value));

        return Task.FromResult(new IdentityDetails(true, new PlannerUserDetails(login ?? UserName.NotSet.Value)));
    }
}

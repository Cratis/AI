// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.Arc.Authorization;

namespace Cratis.AI.Providers;

/// <summary>
/// Authorizes AI administrators and Arc's in-process system execution.
/// </summary>
/// <param name="administrators">The consuming application's administrator authority.</param>
public class AIManagementAuthorization(IAIAdministrators administrators) : IAuthorizationPolicy
{
    /// <inheritdoc/>
    public async ValueTask<bool> IsAuthorized(AuthorizationPolicyContext context, CancellationToken cancellationToken)
    {
        if (context.Principal?.Identity is not ClaimsIdentity { IsAuthenticated: true } identity)
        {
            return false;
        }

        if (identity.AuthenticationType == SystemPrincipal.AuthenticationType &&
            identity.FindFirst(ClaimTypes.NameIdentifier)?.Value == SystemPrincipal.Subject)
        {
            return true;
        }

        try
        {
            return await administrators.IsAdministrator(context.Principal, cancellationToken);
        }
        catch (Exception)
        {
            // An unavailable administrator authority does not grant management access.
            return false;
        }
    }
}

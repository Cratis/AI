// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Identity;

/// <summary>
/// An <see cref="ICurrentUser"/> reading the user from the current HTTP request's claims principal -
/// populated when the Planner runs behind an authenticating proxy; not set otherwise.
/// </summary>
/// <param name="httpContextAccessor">The <see cref="IHttpContextAccessor"/> for the current request.</param>
public class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    static readonly string[] _claimTypes = ["preferred_username", "login", "name", System.Security.Claims.ClaimTypes.Name];

    /// <inheritdoc/>
    public UserName GetUserName()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user?.Identity?.IsAuthenticated != true)
        {
            return UserName.NotSet;
        }

        foreach (var claimType in _claimTypes)
        {
            var value = user.FindFirst(claimType)?.Value;
            if (!string.IsNullOrEmpty(value))
            {
                return value;
            }
        }

        return UserName.NotSet;
    }
}

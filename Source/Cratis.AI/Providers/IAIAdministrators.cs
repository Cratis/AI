// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace Cratis.AI.Providers;

/// <summary>
/// Lets the consuming application identify administrators allowed to manage AI configuration and usage.
/// </summary>
public interface IAIAdministrators
{
    /// <summary>
    /// Determines whether an authenticated principal is an AI administrator in the current scope.
    /// </summary>
    /// <param name="principal">The authenticated caller.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Whether the caller may administer AI.</returns>
    ValueTask<bool> IsAdministrator(ClaimsPrincipal principal, CancellationToken cancellationToken);
}

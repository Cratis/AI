// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace Cratis.AI.Providers;

/// <summary>
/// Denies administrator access until the consuming application supplies its own authority.
/// </summary>
public class DenyAIAdministrators : IAIAdministrators
{
    /// <inheritdoc/>
    public ValueTask<bool> IsAdministrator(ClaimsPrincipal principal, CancellationToken cancellationToken) => ValueTask.FromResult(false);
}

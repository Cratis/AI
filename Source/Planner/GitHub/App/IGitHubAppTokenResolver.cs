// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.App;

/// <summary>
/// Defines a resolver for the installation access token to use for a given account - the Planner
/// can have the GitHub App installed on more than one organization, each with its own installation.
/// </summary>
public interface IGitHubAppTokenResolver
{
    /// <summary>
    /// Gets a fresh installation access token for an account.
    /// </summary>
    /// <param name="organization">The account (organization or user) to get a token for.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The installation access token.</returns>
    Task<string> GetToken(OrganizationName organization, CancellationToken cancellationToken = default);
}

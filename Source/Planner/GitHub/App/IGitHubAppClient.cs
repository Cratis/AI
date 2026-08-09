// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.App;

/// <summary>
/// Defines the Planner's client for authenticating as the GitHub App itself - signing the App's own
/// JWT and exchanging it for per-installation access tokens.
/// </summary>
public interface IGitHubAppClient
{
    /// <summary>
    /// Gets a short-lived access token for an installation of the App.
    /// </summary>
    /// <param name="installation">The installation to get a token for.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The installation access token.</returns>
    Task<string> GetInstallationToken(InstallationId installation, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the login of the account (organization or user) an installation belongs to.
    /// </summary>
    /// <param name="installation">The installation to look up.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The login of the account the installation belongs to.</returns>
    Task<OrganizationName> GetInstallationAccount(InstallationId installation, CancellationToken cancellationToken = default);
}

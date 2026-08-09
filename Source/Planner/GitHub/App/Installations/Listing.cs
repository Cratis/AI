// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;

namespace Planner.GitHub.App.Installations;

/// <summary>
/// Read model for the accounts the GitHub App is installed on. Safe to expose to the frontend - it
/// carries no secret material, only which accounts have installed the App.
/// </summary>
/// <param name="Id">The installation identity.</param>
/// <param name="Account">The login of the account the App is installed on.</param>
[ReadModel]
[FromEvent<GitHubAppInstalled>]
[RemovedWith<GitHubAppUninstalled>]
public record GitHubAppInstallation(InstallationId Id, OrganizationName Account)
{
    /// <summary>
    /// Observes every account the GitHub App is installed on.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the installations.</param>
    /// <returns>An observable of every installation.</returns>
    public static ISubject<IEnumerable<GitHubAppInstallation>> AllGitHubAppInstallations(IMongoCollection<GitHubAppInstallation> collection) =>
        collection.Observe();
}

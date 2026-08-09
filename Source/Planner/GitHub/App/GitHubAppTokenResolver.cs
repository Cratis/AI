// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.DependencyInjection;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Planner.GitHub.App.Installations;

namespace Planner.GitHub.App;

/// <summary>
/// An <see cref="IGitHubAppTokenResolver"/> that picks the installation matching the requested
/// account, falling back to the only configured installation when there is exactly one.
/// </summary>
/// <param name="appClient">The <see cref="IGitHubAppClient"/> to mint installation tokens with.</param>
/// <param name="installations">The installation read models.</param>
/// <param name="options">The <see cref="GitHubAppOptions"/> the App is configured from.</param>
[Singleton]
public class GitHubAppTokenResolver(
    IGitHubAppClient appClient,
    IMongoCollection<GitHubAppInstallation> installations,
    IOptions<GitHubAppOptions> options) : IGitHubAppTokenResolver
{
    /// <inheritdoc/>
    public async Task<string> GetToken(OrganizationName organization, CancellationToken cancellationToken = default)
    {
        // Not having an App at all and having one that is not installed anywhere are different problems
        // with different fixes, and whoever sees the failure needs to be told which one they are looking at.
        if (!options.Value.IsConfigured)
        {
            throw new GitHubAppNotConfigured();
        }

        var cursor = await installations.FindAsync(FilterDefinition<GitHubAppInstallation>.Empty, cancellationToken: cancellationToken);
        var all = await cursor.ToListAsync(cancellationToken);

        var installation = all.Find(candidate => candidate.Account == organization)
            ?? (all.Count == 1 ? all[0] : null)
            ?? throw new GitHubAppNotInstalled(organization);

        return await appClient.GetInstallationToken(installation.Id, cancellationToken);
    }
}

/// <summary>
/// The exception that is thrown when no GitHub App has been configured at all, so nothing can be
/// authenticated against GitHub.
/// </summary>
public class GitHubAppNotConfigured()
    : Exception("No GitHub App is configured. Connect one under Settings - GitHub before the Planner can talk to GitHub.");

/// <summary>
/// The exception that is thrown when the GitHub App has no installation matching the requested account.
/// </summary>
/// <param name="organization">The account no matching installation was found for.</param>
public class GitHubAppNotInstalled(OrganizationName organization)
    : Exception($"The GitHub App is not installed on '{organization.Value}'. Install it on the account under Settings - GitHub.");

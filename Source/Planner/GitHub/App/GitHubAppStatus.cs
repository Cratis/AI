// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;

namespace Planner.GitHub.App;

/// <summary>
/// The GitHub App's own configuration status - whether it has been configured, and the non-secret
/// details needed to build its installation URL. A plain configuration snapshot, not a Chronicle
/// projection - carries no secret material.
/// </summary>
/// <param name="IsConfigured">Whether the App has been configured with the minimum required to authenticate.</param>
/// <param name="Slug">The App's URL-friendly slug.</param>
/// <param name="Name">The display name of the App.</param>
[ReadModel]
public record GitHubAppStatus(bool IsConfigured, string Slug, string Name)
{
    /// <summary>
    /// Gets the current GitHub App configuration status.
    /// </summary>
    /// <param name="options">The <see cref="GitHubAppOptions"/> the App is configured from.</param>
    /// <returns>The current status.</returns>
    public static GitHubAppStatus Current(IOptions<GitHubAppOptions> options) =>
        new(options.Value.IsConfigured, options.Value.Slug, options.Value.Name);
}

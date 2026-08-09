// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub;

/// <summary>
/// Represents the configuration for talking to GitHub, bound from the <c>Planner:GitHub</c> configuration section.
/// Authentication itself is configured separately - see <see cref="App.GitHubAppOptions"/>.
/// </summary>
public class GitHubOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:GitHub";

    /// <summary>
    /// Gets or sets the base URL of the GitHub REST API.
    /// </summary>
    public string ApiBaseUrl { get; set; } = "https://api.github.com";
}

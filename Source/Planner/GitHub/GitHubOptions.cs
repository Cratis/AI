// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub;

/// <summary>
/// Represents the configuration for talking to GitHub, bound from the <c>Planner:GitHub</c> configuration section.
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

    /// <summary>
    /// Gets or sets the token used to authenticate against the GitHub API - a fine-grained personal
    /// access token or a GitHub App installation token with access to the configured repositories.
    /// </summary>
    public string Token { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the shared secret GitHub signs webhook deliveries with. When empty, signature
    /// validation is skipped - local development only.
    /// </summary>
    public string WebhookSecret { get; set; } = string.Empty;
}

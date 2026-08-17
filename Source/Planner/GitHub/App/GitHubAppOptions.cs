// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.App;

/// <summary>
/// Represents the configuration for the GitHub App the Planner authenticates as, bound from the
/// <c>Planner:GitHubApp</c> configuration section. Populated from the values GitHub returns after
/// the manifest-flow registration (see <see cref="GitHubAppEndpoints"/>) - set as configuration or
/// environment variables (<c>Planner__GitHubApp__*</c>), the same way the rest of the Planner's
/// deployment-time secrets are, never stored in the event log.
/// </summary>
public class GitHubAppOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:GitHubApp";

    /// <summary>
    /// Gets or sets the numeric App id GitHub assigned.
    /// </summary>
    public string AppId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the GitHub organization the App is registered under and installed into. An App
    /// registered under an organization is owned by it rather than by whoever happened to click
    /// through the registration, so it survives that person leaving. Empty registers a personal App.
    /// </summary>
    public string Organization { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the App's URL-friendly slug, used to build the installation URL.
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the display name of the App.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the App's private key in PEM format, used to sign the JWTs it authenticates with.
    /// </summary>
    public string PrivateKeyPem { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the shared secret GitHub signs webhook deliveries with.
    /// </summary>
    /// <remarks>
    /// <b>Required.</b> The endpoint is public and every delivery it accepts rewrites the issue and
    /// pull request mirrors, so an empty secret rejects every delivery rather than accepting unsigned
    /// ones. The absence is reported as a warning at startup.
    /// </remarks>
    public string WebhookSecret { get; set; } = string.Empty;

    /// <summary>
    /// Gets whether the App has been configured with the minimum required to authenticate.
    /// </summary>
    public bool IsConfigured => !string.IsNullOrEmpty(AppId) && !string.IsNullOrEmpty(PrivateKeyPem);
}

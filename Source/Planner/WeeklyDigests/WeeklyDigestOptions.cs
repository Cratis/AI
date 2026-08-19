// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.WeeklyDigests;

/// <summary>
/// Represents the configuration for the weekly digest webhook and where a digest publishes to,
/// bound from the <c>Planner:WeeklyDigest</c> configuration section.
/// </summary>
public class WeeklyDigestOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:WeeklyDigest";

    /// <summary>
    /// Gets or sets the bearer token the weekly digest job authenticates its delivery with. Empty
    /// accepts unauthenticated deliveries, which is for local development only.
    /// </summary>
    public string WebhookToken { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the Discord webhook URL a digest is posted to when published - empty skips
    /// Discord.
    /// </summary>
    public string DiscordWebhookUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the LinkedIn-bound webhook URL a digest is posted to when published (typically
    /// an automation that turns the post into a LinkedIn share) - empty skips LinkedIn.
    /// </summary>
    public string LinkedInWebhookUrl { get; set; } = string.Empty;
}

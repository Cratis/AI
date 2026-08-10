// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// Represents the configuration for the alert webhook and what happens to what arrives on it, bound
/// from the <c>Planner:Alerts</c> configuration section.
/// </summary>
public class AlertOptions
{
    /// <summary>
    /// The configuration section name the options are bound from.
    /// </summary>
    public const string SectionName = "Planner:Alerts";

    /// <summary>
    /// Gets or sets the shared secret alert deliveries are signed with. Deliveries carry the
    /// signature as <c>X-Planner-Signature-256: sha256=&lt;hex&gt;</c> over the raw body, the same
    /// scheme GitHub uses. Empty accepts unsigned deliveries, which is for local development only -
    /// the endpoint is public, and an unsigned one lets anyone schedule agent work.
    /// </summary>
    public string WebhookSecret { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets whether an alert is investigated by an agent the moment it arrives.
    /// </summary>
    public bool AutoInvestigate { get; set; } = true;

    /// <summary>
    /// Gets or sets the model alerts are investigated with. Operational diagnosis is exactly the
    /// hard-and-risky work the strongest model is for.
    /// </summary>
    public string Model { get; set; } = "opus";

    /// <summary>
    /// Gets or sets the source recorded for a delivery that does not name one - which is every
    /// delivery from a sender that only speaks Discord's webhook shape.
    /// </summary>
    public string DefaultSource { get; set; } = "production";
}

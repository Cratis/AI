// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using System.Text.Json.Nodes;
using Planner.Alerts.Raising;

namespace Planner.Alerts.Webhooks;

/// <summary>
/// Turns whatever a running system posted to the alert webhook into a <see cref="RaiseAlert"/>.
/// </summary>
/// <remarks>
/// Two shapes are understood. The first is the Planner's own - <c>source</c>, <c>title</c>,
/// <c>summary</c>, <c>severity</c>, <c>fingerprint</c> - which is what to send from something new.
/// The second is Discord's webhook payload, because that is what operational alerting already
/// speaks: Cratis Studio's cluster-health watchdog posts <c>embeds[].title</c> and
/// <c>embeds[].description</c> to a Discord webhook URL, and pointing that URL at this endpoint
/// instead has to be the whole integration - no change to the watchdog, no second alerting path to
/// keep working.
/// </remarks>
public static class AlertDelivery
{
    /// <summary>
    /// Parses a delivery body into the command that records it.
    /// </summary>
    /// <param name="body">The raw JSON body of the delivery.</param>
    /// <param name="defaultSource">The source to record when the delivery does not name one.</param>
    /// <returns>The <see cref="RaiseAlert"/> command, or <see langword="null"/> when the body carries no alert.</returns>
    public static RaiseAlert? Parse(string body, AlertSource defaultSource)
    {
        if (TryParseObject(body) is not { } payload)
        {
            return null;
        }

        var embed = (payload["embeds"] as JsonArray)?.OfType<JsonObject>().FirstOrDefault();
        var title = Text(payload["title"]) ?? Text(embed?["title"]) ?? Text(payload["content"]);
        if (string.IsNullOrWhiteSpace(title))
        {
            return null;
        }

        var summary = Text(payload["summary"])
            ?? Text(payload["description"])
            ?? Text(embed?["description"])
            ?? Text(payload["content"])
            ?? string.Empty;

        // A sender that does not fingerprint its alerts still gets deduplication, because the title
        // of an operational alert is itself stable - the watchdog's "3 cluster issue(s) need
        // attention" arrives with the same title for as long as the condition lasts.
        var fingerprint = Text(payload["fingerprint"]) ?? title;
        var source = Text(payload["source"]) ?? defaultSource.Value;

        return new RaiseAlert(source, title, summary, SeverityFrom(payload, embed), fingerprint);
    }

    /// <summary>
    /// Parses a body into a JSON object, treating anything that is not one as no alert.
    /// </summary>
    /// <param name="body">The raw body as delivered.</param>
    /// <returns>The object, or <see langword="null"/> when the body is not a JSON object.</returns>
    /// <remarks>
    /// The endpoint is open to whatever a running system posts at it, and a body that is not JSON at
    /// all has to answer "that is not an alert" rather than fail the request as a server error.
    /// </remarks>
    static JsonObject? TryParseObject(string body)
    {
        try
        {
            return JsonNode.Parse(body) as JsonObject;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>
    /// Reads the severity out of a delivery. A native delivery names it; a Discord one only has the
    /// embed's color, and red is how every alerter in this family says "critical".
    /// </summary>
    /// <param name="payload">The delivery body.</param>
    /// <param name="embed">The first Discord embed, when the delivery has one.</param>
    /// <returns>The severity.</returns>
    static AlertSeverity SeverityFrom(JsonObject payload, JsonObject? embed) =>
        Text(payload["severity"])?.ToLowerInvariant() switch
        {
            "critical" or "error" or "fatal" or "high" => AlertSeverity.Critical,
            "warning" or "warn" or "medium" => AlertSeverity.Warning,
            "information" or "info" or "low" => AlertSeverity.Information,
            _ => ColorSeverity(embed)
        };

    static AlertSeverity ColorSeverity(JsonObject? embed)
    {
        if (embed?["color"] is not JsonValue node || !node.TryGetValue<int>(out var color))
        {
            return AlertSeverity.Warning;
        }

        var red = (color >> 16) & 0xFF;
        var green = (color >> 8) & 0xFF;
        var blue = color & 0xFF;
        return red > green && red > blue ? AlertSeverity.Critical : AlertSeverity.Warning;
    }

    // Deliveries come from systems the Planner does not control, so a field that is a number where a
    // string was expected must read as "not supplied" rather than throw the whole delivery away.
    static string? Text(JsonNode? node) =>
        node is JsonValue value && value.TryGetValue<string>(out var text) && !string.IsNullOrWhiteSpace(text)
            ? text.Trim()
            : null;
}

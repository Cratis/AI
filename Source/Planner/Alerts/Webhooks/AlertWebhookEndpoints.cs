// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Planner.Identity;

namespace Planner.Alerts.Webhooks;

/// <summary>
/// The transport boundary alerts from running systems arrive through. Deliveries are validated
/// against the configured shared secret and translated into the Planner's own command - see
/// <see cref="AlertDelivery"/> for the payload shapes accepted.
/// </summary>
public static class AlertWebhookEndpoints
{
    /// <summary>
    /// The header a delivery carries its signature in.
    /// </summary>
    public const string SignatureHeader = "X-Planner-Signature-256";

    /// <summary>
    /// Maps the alert webhook endpoint.
    /// </summary>
    /// <param name="app">The <see cref="WebApplication"/> to map on.</param>
    /// <returns>The same <see cref="WebApplication"/> for chaining.</returns>
    public static WebApplication MapAlertWebhooks(this WebApplication app)
    {
        app.MapPost("/webhooks/alerts", async (
            HttpRequest request,
            ICommandPipeline commandPipeline,
            IOptions<AlertOptions> options) =>
        {
            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();

            if (!SignatureIsValid(request, body, options.Value.WebhookSecret))
            {
                return Results.Unauthorized();
            }

            // The HMAC check above is the caller's real credential - establish the trusted principal
            // Arc's authorization reads for the rest of this request immediately after it passes, and
            // before the command below.
            request.HttpContext.EstablishAsVerified();

            var command = AlertDelivery.Parse(body, options.Value.DefaultSource);
            if (command is null)
            {
                return Results.BadRequest("The delivery carried nothing that could be read as an alert.");
            }

            var result = await commandPipeline.Execute(command);

            // A rejected alert is the sender's problem to see, not something to swallow: an alerter
            // that gets a 200 for a delivery the Planner threw away goes on believing it is covered.
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.ValidationResults);
        });

        return app;
    }

    /// <summary>
    /// Verifies a delivery's HMAC signature over the raw body - the same scheme GitHub uses, so a
    /// sender that can already sign a GitHub webhook can sign this one.
    /// </summary>
    /// <param name="request">The incoming request.</param>
    /// <param name="body">The raw body as delivered.</param>
    /// <param name="secret">The configured shared secret - empty accepts everything.</param>
    /// <returns><see langword="true"/> when the delivery is authentic.</returns>
    static bool SignatureIsValid(HttpRequest request, string body, string secret)
    {
        if (string.IsNullOrEmpty(secret))
        {
            // No secret configured - local development only.
            return true;
        }

        var signature = request.Headers[SignatureHeader].ToString();
        if (!signature.StartsWith("sha256=", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var provided = signature["sha256=".Length..];
        if (provided.Length != 64 || !provided.All(char.IsAsciiHexDigit))
        {
            return false;
        }

        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(body));
        return CryptographicOperations.FixedTimeEquals(Convert.FromHexString(provided), expected);
    }
}

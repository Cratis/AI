// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Options;
using Planner.Identity;
using Planner.WeeklyDigests.Receiving;

namespace Planner.WeeklyDigests.Webhooks;

/// <summary>
/// The transport boundary the weekly digest job posts its result through.
/// </summary>
public static class WeeklyDigestWebhookEndpoints
{
    /// <summary>
    /// Maps the weekly digest webhook endpoint.
    /// </summary>
    /// <param name="app">The <see cref="WebApplication"/> to map on.</param>
    /// <returns>The same <see cref="WebApplication"/> for chaining.</returns>
    public static WebApplication MapWeeklyDigestWebhooks(this WebApplication app)
    {
        app.MapPost("/webhooks/weekly-digest", async (
            HttpRequest request,
            ICommandPipeline commandPipeline,
            IOptions<WeeklyDigestOptions> options) =>
        {
            if (!TokenIsValid(request, options.Value.WebhookToken))
            {
                return Results.Unauthorized();
            }

            // The bearer token above is the caller's real credential - establish the trusted principal
            // Arc's authorization reads for the rest of this request immediately after it passes, and
            // before the command below.
            request.HttpContext.EstablishAsVerified();

            using var reader = new StreamReader(request.Body);
            var body = await reader.ReadToEndAsync();
            if (string.IsNullOrWhiteSpace(body))
            {
                return Results.BadRequest("The delivery carried no content.");
            }

            var result = await commandPipeline.Execute(new ReceiveWeeklyDigest(body));
            return result.IsSuccess ? Results.Ok() : Results.BadRequest(result.ValidationResults);
        });

        return app;
    }

    /// <summary>
    /// Validates the bearer token a delivery carries against the configured token.
    /// </summary>
    /// <param name="request">The incoming request.</param>
    /// <param name="token">The configured token - empty accepts everything, for local development only.</param>
    /// <returns><see langword="true"/> when the delivery is authentic.</returns>
    static bool TokenIsValid(HttpRequest request, string token)
    {
        if (string.IsNullOrEmpty(token))
        {
            return true;
        }

        var header = request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var presented = header["Bearer ".Length..].Trim();
        var presentedBytes = System.Text.Encoding.UTF8.GetBytes(presented);
        var tokenBytes = System.Text.Encoding.UTF8.GetBytes(token);
        return presentedBytes.Length == tokenBytes.Length &&
            System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(presentedBytes, tokenBytes);
    }
}

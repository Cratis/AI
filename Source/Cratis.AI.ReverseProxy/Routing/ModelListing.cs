// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.ReverseProxy.Endpoints;
using Cratis.AI.ReverseProxy.Protocols;
using Microsoft.AspNetCore.Http;

namespace Cratis.AI.ReverseProxy.Routing;

/// <summary>
/// Answers <c>GET /v1/models</c> from the endpoints the proxy knows, in whichever protocol's shape the caller speaks, so an SDK's
/// "list models" call shows exactly the models it can use through this proxy.
/// </summary>
public static class ModelListing
{
    /// <summary>
    /// Writes the listing.
    /// </summary>
    /// <param name="context">The request.</param>
    /// <param name="endpoints">The <see cref="IModelEndpoints"/>.</param>
    /// <param name="access">The <see cref="IModelAccess"/>.</param>
    /// <returns>A <see cref="Task"/> that completes when the response is written.</returns>
    public static async Task Respond(HttpContext context, IModelEndpoints endpoints, IModelAccess access)
    {
        var protocol = AIProtocols.Detect("/v1/models", context.Request.Headers.ContainsKey(AIProtocols.AnthropicVersionHeader));
        if (!await access.IsCaller(context))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(AIProtocols.Error(protocol, StatusCodes.Status401Unauthorized, "authentication_error", "A valid credential is required"));
            return;
        }

        var models = new List<(ServedModel Model, string Endpoint)>();
        foreach (var endpoint in endpoints.All.Where(endpoint => endpoint.Protocols.HasFlag(protocol)))
        {
            if (await access.Allows(context, endpoint))
            {
                models.AddRange(endpoint.Models.Select(model => (model, endpoint.Name)));
            }
        }

        // A model two endpoints both serve is listed once: the proxy sends it to the first, so the second is not reachable by name.
        var distinct = models.DistinctBy(entry => entry.Model.Name, StringComparer.OrdinalIgnoreCase).ToArray();
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(protocol == AIProtocol.Anthropic ? Anthropic(distinct) : OpenAI(distinct));
    }

    static string OpenAI((ServedModel Model, string Endpoint)[] models) => JsonSerializer.Serialize(new
    {
        @object = "list",
        data = models.Select(entry => new { id = entry.Model.Name, @object = "model", created = 0, owned_by = entry.Endpoint })
    });

    static string Anthropic((ServedModel Model, string Endpoint)[] models) => JsonSerializer.Serialize(new
    {
        data = models.Select(entry => new
        {
            type = "model",
            id = entry.Model.Name,
            display_name = entry.Model.DisplayName.Length > 0 ? entry.Model.DisplayName : entry.Model.Name,
            created_at = "1970-01-01T00:00:00Z"
        }),
        has_more = false,
        first_id = models.Length > 0 ? models[0].Model.Name : null,
        last_id = models.Length > 0 ? models[^1].Model.Name : null
    });
}

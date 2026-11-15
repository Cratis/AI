// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.ReverseProxy.Endpoints;
using Cratis.AI.ReverseProxy.Protocols;
using Microsoft.AspNetCore.Http;
using Yarp.ReverseProxy;
using Yarp.ReverseProxy.Model;

namespace Cratis.AI.ReverseProxy.Routing;

/// <summary>
/// The proxy's own stage in YARP's pipeline. It works out which protocol the caller speaks, lets only known model paths through,
/// finds the endpoint - by the <c>endpoints/{id}</c> the caller pinned, or by the <c>model</c> in the request body - checks the
/// caller may use it, and points the request at that endpoint's cluster.
/// </summary>
/// <param name="next">The next stage.</param>
/// <param name="endpoints">The <see cref="IModelEndpoints"/>.</param>
/// <param name="access">The <see cref="IModelAccess"/>.</param>
/// <param name="proxyState">Finds the cluster YARP built for an endpoint.</param>
/// <param name="options">The <see cref="ModelProxyOptions"/>.</param>
public class ModelRoutingMiddleware(RequestDelegate next, IModelEndpoints endpoints, IModelAccess access, IProxyStateLookup proxyState, ModelProxyOptions options)
{
    const string PinnedSegment = "/endpoints/";

    /// <summary>
    /// Handles one request.
    /// </summary>
    /// <param name="context">The <see cref="HttpContext"/>.</param>
    /// <returns>A <see cref="Task"/> that completes when the request has been handled.</returns>
    public async Task InvokeAsync(HttpContext context)
    {
        var prefix = options.NormalizedPrefix;
        var path = context.Request.Path.Value ?? string.Empty;
        var below = path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) ? path[prefix.Length..] : path;

        var pinnedId = string.Empty;
        if (below.StartsWith(PinnedSegment, StringComparison.OrdinalIgnoreCase))
        {
            var rest = below[PinnedSegment.Length..];
            var slash = rest.IndexOf('/');
            pinnedId = (slash < 0 ? rest : rest[..slash]).ToLowerInvariant();
            below = slash < 0 ? string.Empty : rest[slash..];
        }

        var hasVersion = context.Request.Headers.ContainsKey(AIProtocols.AnthropicVersionHeader);
        var protocol = AIProtocols.Detect(below, hasVersion);
        if (protocol == AIProtocol.None)
        {
            await Refuse(context, hasVersion ? AIProtocol.Anthropic : AIProtocol.OpenAI, StatusCodes.Status404NotFound, "not_found_error", $"'{below}' is not a path this proxy serves");
            return;
        }

        var isListing = below.StartsWith("/v1/models", StringComparison.OrdinalIgnoreCase);
        var allowedMethod = isListing ? HttpMethods.IsGet(context.Request.Method) : HttpMethods.IsPost(context.Request.Method);
        if (!allowedMethod)
        {
            await Refuse(context, protocol, StatusCodes.Status405MethodNotAllowed, "invalid_request_error", $"{context.Request.Method} is not allowed on '{below}'");
            return;
        }

        if (!await access.IsCaller(context))
        {
            await Refuse(context, protocol, StatusCodes.Status401Unauthorized, "authentication_error", "A valid credential is required");
            return;
        }

        var (endpoint, problem) = await Resolve(context, protocol, pinnedId, isListing);
        if (endpoint is null)
        {
            await Refuse(context, protocol, problem!.Value.Status, problem.Value.Type, problem.Value.Message);
            return;
        }

        if (!await access.Allows(context, endpoint))
        {
            await Refuse(context, protocol, StatusCodes.Status403Forbidden, "permission_error", "This credential may not use that model");
            return;
        }

        if (!endpoint.Protocols.HasFlag(protocol))
        {
            await Refuse(context, protocol, StatusCodes.Status400BadRequest, "invalid_request_error", $"'{endpoint.Name}' does not speak the {protocol} protocol; it speaks {string.Join(" and ", AIProtocols.Names(endpoint.Protocols))}");
            return;
        }

        if (!proxyState.TryGetCluster(endpoint.Id, out var cluster))
        {
            await Refuse(context, protocol, StatusCodes.Status503ServiceUnavailable, "overloaded_error", $"'{endpoint.Name}' has only just connected - try again in a moment");
            return;
        }

        if (protocol == AIProtocol.Anthropic && !hasVersion)
        {
            context.Request.Headers[AIProtocols.AnthropicVersionHeader] = AIProtocols.DefaultAnthropicVersion;
        }

        context.Request.Path = $"{prefix}{below}";
        context.ReassignProxyRequest(cluster);
        await next(context);
    }

    static Task Refuse(HttpContext context, AIProtocol protocol, int status, string type, string message)
    {
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/json";
        return context.Response.WriteAsync(AIProtocols.Error(protocol, status, type, message));
    }

    async Task<(ModelEndpoint? Endpoint, (int Status, string Type, string Message)? Problem)> Resolve(HttpContext context, AIProtocol protocol, string pinnedId, bool isListing)
    {
        if (pinnedId.Length > 0)
        {
            return endpoints.Find(pinnedId) is { } pinned
                ? (pinned, null)
                : (null, (StatusCodes.Status404NotFound, "not_found_error", $"There is no endpoint '{pinnedId}'"));
        }

        if (isListing)
        {
            // Unpinned listings are answered by the proxy itself and never reach a cluster.
            return (null, (StatusCodes.Status404NotFound, "not_found_error", "List models at the proxy root, or pin an endpoint"));
        }

        var model = await ReadModel(context);
        if (model is null)
        {
            return (null, (StatusCodes.Status400BadRequest, "invalid_request_error", "The request body must be JSON with a 'model'"));
        }

        return endpoints.FindForModel(model, protocol) is { } found
            ? (found, null)
            : (null, (StatusCodes.Status404NotFound, "not_found_error", $"No connected endpoint serves the model '{model}' over the {protocol} protocol"));
    }

    async Task<string?> ReadModel(HttpContext context)
    {
        if (context.Request.ContentLength > options.MaxRequestBodyBytes)
        {
            return null;
        }

        context.Request.EnableBuffering(bufferThreshold: 1024 * 1024, bufferLimit: options.MaxRequestBodyBytes);
        try
        {
            using var document = await JsonDocument.ParseAsync(context.Request.Body, cancellationToken: context.RequestAborted);
            return document.RootElement.ValueKind == JsonValueKind.Object &&
                   document.RootElement.TryGetProperty("model", out var model) &&
                   model.ValueKind == JsonValueKind.String &&
                   model.GetString() is { Length: > 0 } name
                ? name
                : null;
        }
        catch (JsonException)
        {
            return null;
        }
        catch (IOException)
        {
            return null;
        }
        finally
        {
            context.Request.Body.Position = 0;
        }
    }
}

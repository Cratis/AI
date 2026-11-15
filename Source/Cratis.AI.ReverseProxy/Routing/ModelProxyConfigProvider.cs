// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;
using Cratis.AI.ReverseProxy.Transport;
using Microsoft.Extensions.Primitives;
using Yarp.ReverseProxy.Configuration;

namespace Cratis.AI.ReverseProxy.Routing;

/// <summary>
/// Describes the proxy to YARP from the endpoints that exist right now: one catch-all route under the prefix, and one cluster per
/// endpoint that <see cref="ModelRoutingMiddleware"/> picks from by model name. The configuration is rebuilt whenever the
/// endpoints change.
/// </summary>
/// <param name="endpoints">The <see cref="IModelEndpoints"/>.</param>
/// <param name="options">The <see cref="ModelProxyOptions"/>.</param>
public class ModelProxyConfigProvider(IModelEndpoints endpoints, ModelProxyOptions options) : IProxyConfigProvider
{
    /// <summary>
    /// The cluster the route names before the middleware has chosen the real one. It never has a destination.
    /// </summary>
    public const string UnroutedCluster = "unrouted";

    /// <summary>
    /// The identity of the one route.
    /// </summary>
    public const string RouteId = "cratis-ai-models";

    /// <inheritdoc/>
    public IProxyConfig GetConfig() => new Configuration(Routes(), Clusters(), endpoints.GetChangeToken());

    RouteConfig[] Routes() =>
    [
        new()
        {
            RouteId = RouteId,
            ClusterId = UnroutedCluster,
            Match = new() { Path = $"{options.NormalizedPrefix}/{{**catch-all}}" },
            Transforms = options.NormalizedPrefix.Length == 0 ? null : [new Dictionary<string, string> { ["PathRemovePrefix"] = options.NormalizedPrefix }]
        }
    ];

    ClusterConfig[] Clusters() =>
    [
        new() { ClusterId = UnroutedCluster, Destinations = new Dictionary<string, DestinationConfig>() },
        .. endpoints.All.Select(endpoint => new ClusterConfig
        {
            ClusterId = endpoint.Id,
            Destinations = new Dictionary<string, DestinationConfig> { ["primary"] = new() { Address = ModelEndpointHosts.AddressOf(endpoint.Id) } },
            HttpRequest = new() { ActivityTimeout = options.ActivityTimeout },
        })
    ];

    sealed class Configuration(IReadOnlyList<RouteConfig> routes, IReadOnlyList<ClusterConfig> clusters, IChangeToken changeToken) : IProxyConfig
    {
        public IReadOnlyList<RouteConfig> Routes { get; } = routes;

        public IReadOnlyList<ClusterConfig> Clusters { get; } = clusters;

        public IChangeToken ChangeToken { get; } = changeToken;
    }
}

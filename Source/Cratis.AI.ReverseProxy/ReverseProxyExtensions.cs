// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.ReverseProxy.Endpoints;
using Cratis.AI.ReverseProxy.Routing;
using Cratis.AI.ReverseProxy.Transport;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Yarp.ReverseProxy.Configuration;
using Yarp.ReverseProxy.Forwarder;

namespace Cratis.AI.ReverseProxy;

/// <summary>
/// Wires the AI reverse proxy into an ASP.NET Core application.
/// </summary>
public static class ReverseProxyExtensions
{
    /// <summary>
    /// Registers the proxy. Register an <see cref="IModelAccess"/> afterwards or the proxy lets nobody in, and register an
    /// <see cref="IModelTransport"/> to reach backends some other way than directly over HTTP.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/>.</param>
    /// <param name="configure">Adjusts the <see cref="ModelProxyOptions"/>.</param>
    /// <returns>The <see cref="IServiceCollection"/> for chaining.</returns>
    public static IServiceCollection AddCratisAIReverseProxy(this IServiceCollection services, Action<ModelProxyOptions>? configure = null)
    {
        var options = new ModelProxyOptions();
        configure?.Invoke(options);

        services.TryAddSingleton(options);
        services.TryAddSingleton<IModelEndpoints, ModelEndpoints>();
        services.TryAddSingleton<IModelAccess, DenyModelAccess>();
        services.TryAddSingleton<IModelTransport, DirectModelTransport>();
        services.TryAddSingleton<IProxyConfigProvider, ModelProxyConfigProvider>();
        services.TryAddSingleton<IForwarderHttpClientFactory, ModelForwarderHttpClientFactory>();
        services.AddReverseProxy();

        // AddReverseProxy registers YARP's own socket-based factory first; ours replaces it so every request goes through the transport.
        services.Replace(ServiceDescriptor.Singleton<IForwarderHttpClientFactory, ModelForwarderHttpClientFactory>());
        services.Replace(ServiceDescriptor.Singleton<IProxyConfigProvider, ModelProxyConfigProvider>());
        return services;
    }

    /// <summary>
    /// Maps the proxy under its configured prefix: <c>GET /v1/models</c> answered locally, and every model request routed to
    /// the endpoint that serves its model.
    /// </summary>
    /// <param name="endpoints">The <see cref="IEndpointRouteBuilder"/>.</param>
    /// <returns>The <see cref="IEndpointConventionBuilder"/>, for example to add authorization.</returns>
    public static IEndpointConventionBuilder MapCratisAIReverseProxy(this IEndpointRouteBuilder endpoints)
    {
        var options = endpoints.ServiceProvider.GetRequiredService<ModelProxyOptions>();
        var listing = endpoints.MapGet(
            $"{options.NormalizedPrefix}/v1/models",
            (HttpContext context, IModelEndpoints models, IModelAccess access) => ModelListing.Respond(context, models, access));

        var proxy = endpoints.MapReverseProxy(pipeline =>
        {
            pipeline.UseMiddleware<ModelRoutingMiddleware>();
            pipeline.UseLoadBalancing();
        });

        return new CompositeConventionBuilder(listing, proxy);
    }

    sealed class CompositeConventionBuilder(params IEndpointConventionBuilder[] builders) : IEndpointConventionBuilder
    {
        public void Add(Action<EndpointBuilder> convention)
        {
            foreach (var builder in builders)
            {
                builder.Add(convention);
            }
        }

        public void Finally(Action<EndpointBuilder> finallyConvention)
        {
            foreach (var builder in builders)
            {
                builder.Finally(finallyConvention);
            }
        }
    }
}

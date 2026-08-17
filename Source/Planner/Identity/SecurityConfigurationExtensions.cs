// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Microsoft.Extensions.Options;

namespace Planner.Identity;

/// <summary>
/// Wires the Planner's security boundary - who a request executes as, and what the deployment is
/// told about the gaps it left open.
/// </summary>
public static class SecurityConfigurationExtensions
{
    /// <summary>
    /// Adds the security configuration and the identity the Planner authorizes against.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection"/> to add to.</param>
    /// <param name="configuration">The <see cref="IConfiguration"/> to bind from.</param>
    /// <returns>The same <see cref="IServiceCollection"/> for chaining.</returns>
    public static IServiceCollection AddPlannerSecurity(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<SecurityOptions>(configuration.GetSection(SecurityOptions.SectionName));
        services.AddHttpContextAccessor();
        services.AddSingleton<ICurrentUser, CurrentUser>();

        // Registered explicitly rather than left to convention discovery: the alert reactor needs it
        // to schedule an investigation, and a security mechanism that only works if a discovery
        // convention happens to pick it up is one that fails silently at the worst moment.
        services.AddSingleton<ISystemExecution, SystemExecution>();
        services.AddHostedService<SecurityAdvisory>();

        return services;
    }

    /// <summary>
    /// Establishes the principal a request executes as, from what the authenticating proxy recorded
    /// on it. Must run before anything that authorizes - Arc's command pipeline and the worker
    /// callback boundary both read the principal off the request.
    /// </summary>
    /// <param name="app">The <see cref="WebApplication"/> to add the middleware to.</param>
    /// <returns>The same <see cref="WebApplication"/> for chaining.</returns>
    public static WebApplication UsePlannerSecurity(this WebApplication app)
    {
        var options = app.Services.GetRequiredService<IOptions<SecurityOptions>>();

        app.Use(async (context, next) =>
        {
            // A real authentication handler, if a deployment ever adds one, wins over the proxy header.
            if (context.User.Identity?.IsAuthenticated != true)
            {
                var principal = ProxyIdentity.Resolve(context.Request, options.Value);
                if (principal is not null)
                {
                    context.User = principal;
                }
            }

            await next(context);
        });

        return app;
    }
}

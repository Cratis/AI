// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.Synchronization;

/// <summary>
/// The transport boundary the "Sync now" action on the Repositories page reaches - deliberately not
/// an Arc command since it appends no event of its own; it just pokes the consolidation grain that
/// otherwise only runs once a day.
/// </summary>
public static class GitHubSynchronizationEndpoints
{
    /// <summary>
    /// Maps the "Sync now" endpoint.
    /// </summary>
    /// <param name="app">The <see cref="WebApplication"/> to map on.</param>
    /// <returns>The same <see cref="WebApplication"/> for chaining.</returns>
    public static WebApplication MapGitHubSynchronizationEndpoints(this WebApplication app)
    {
        app.MapPost("/api/github/synchronize", async (HttpContext context, IGrainFactory grains) =>
        {
            if (context.User?.Identity?.IsAuthenticated != true)
            {
                return Results.Unauthorized();
            }

            await grains.GetGrain<IGitHubSynchronizer>(0).SynchronizeNow();
            return Results.Accepted();
        });

        return app;
    }
}

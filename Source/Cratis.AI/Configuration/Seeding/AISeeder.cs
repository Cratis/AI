// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Configuration.Seeding;

/// <summary>
/// Applies every <see cref="SeededOpenAIProvider"/> the host registered, once, shortly after startup.
/// </summary>
/// <remarks>
/// Runs with the package's own authority, the same way the model catalog pass does, so only server
/// code that called <see cref="CratisAIBuilder.SeedOpenAIProvider"/> can cause it - there is no
/// endpoint to reach. It waits for the event store and projections to come up, retries while they are
/// not ready, and logs rather than throws: a seed that could not run must not stop the host.
/// </remarks>
/// <param name="seeds">The seeds to apply.</param>
/// <param name="scopeFactory">Creates the scope the seeding's collaborators are resolved from.</param>
/// <param name="timeProvider">The clock the delays are measured on.</param>
/// <param name="logger">The logger.</param>
public class AISeeder(
    IEnumerable<SeededOpenAIProvider> seeds,
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    ILogger<AISeeder> logger) : BackgroundService
{
    /// <summary>
    /// How many times the seeding is attempted before giving up until the next start.
    /// </summary>
    public const int MaxAttempts = 5;

    /// <summary>
    /// Long enough for the event store and the provider projections to be up.
    /// </summary>
    public static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(10);

    /// <summary>
    /// How long to wait before trying again when the seeding could not run.
    /// </summary>
    public static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(15);

    /// <summary>
    /// Applies the seeds now rather than after the startup delay.
    /// </summary>
    /// <returns><see langword="false"/> when a seed was left incomplete and is worth another attempt.</returns>
    public async Task<bool> RunOnce()
    {
        using var scope = scopeFactory.CreateScope();
        var services = scope.ServiceProvider;
        using var systemScope = AIInternalExecution.Begin(
            services.GetRequiredService<ISystemExecution>(),
            services.GetRequiredService<IHttpRequestContextAccessor>());
        var seeding = ActivatorUtilities.CreateInstance<AISeeding>(services);
        var complete = true;
        foreach (var seed in seeds)
        {
            complete &= await seeding.Apply(seed) != SeedOutcome.Failed;
        }

        return complete;
    }

    /// <inheritdoc/>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(StartupDelay, timeProvider, stoppingToken);
            for (var attempt = 1; attempt <= MaxAttempts && !stoppingToken.IsCancellationRequested; attempt++)
            {
                if (await TryRunOnce(attempt))
                {
                    return;
                }

                await Task.Delay(RetryDelay, timeProvider, stoppingToken);
            }
        }
        catch (OperationCanceledException)
        {
            // The host is stopping.
        }
    }

    async Task<bool> TryRunOnce(int attempt)
    {
        try
        {
            var complete = await RunOnce();
            if (!complete)
            {
                logger.SeedingIncomplete(attempt, MaxAttempts);
            }

            return complete;
        }
        catch (Exception exception)
        {
            logger.CouldNotSeed(attempt, MaxAttempts, exception);
            return false;
        }
    }
}

/// <summary>
/// Log messages for <see cref="AISeeder"/>.
/// </summary>
internal static partial class AISeederLog
{
    [LoggerMessage(LogLevel.Warning, "AI seeding left a seed incomplete (attempt {Attempt} of {MaxAttempts})")]
    internal static partial void SeedingIncomplete(this ILogger logger, int attempt, int maxAttempts);

    [LoggerMessage(LogLevel.Warning, "AI seeding could not run (attempt {Attempt} of {MaxAttempts})")]
    internal static partial void CouldNotSeed(this ILogger logger, int attempt, int maxAttempts, Exception exception);
}

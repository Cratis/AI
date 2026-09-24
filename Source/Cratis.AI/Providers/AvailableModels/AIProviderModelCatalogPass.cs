// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers.Listing;
using Cratis.Arc.Authorization;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Keeps every configured provider's model catalog current (#1187) - the pass that backfills a
/// provider nobody has ever asked, retries one whose last ask failed, and re-asks one whose catalog
/// has gone stale.
/// </summary>
/// <remarks>
/// <para>
/// This is what makes removing the hardcoded vendor catalogs safe. A provider registered before
/// discovery existed has no catalog on its stream, and with no default table behind tier resolution
/// it would have nothing to dispatch to until somebody opened Settings and pressed a button. The
/// first run of this pass gives it one.
/// </para>
/// <para>
/// It is also the retry that <see cref="DiscoverModelsWhenProviderAdded"/> deliberately does not
/// have: a vendor that was down when a provider was registered records the failure and is asked
/// again here, rather than the registration reactor deferring and - being <c>[OnceOnly]</c> - never
/// coming back.
/// </para>
/// <para>
/// A model catalog changes on the order of weeks, and asking costs a round trip per provider, so the
/// cadence is deliberately slow. Providers that already have a fresh catalog are skipped entirely,
/// which is why a run on a healthy deployment does no work at all.
/// </para>
/// </remarks>
/// <param name="scopeFactory">Creates the scope the pass's collaborators are resolved from - a hosted service outlives any request scope.</param>
/// <param name="timeProvider">The clock staleness is measured against.</param>
/// <param name="logger">The logger.</param>
public class AIProviderModelCatalogPass(
    IServiceScopeFactory scopeFactory,
    TimeProvider timeProvider,
    ILogger<AIProviderModelCatalogPass> logger) : BackgroundService
{
    /// <summary>
    /// How long a catalog stays good for before it is asked again.
    /// </summary>
    public static readonly TimeSpan StaleAfter = TimeSpan.FromHours(12);

    /// <summary>
    /// How often the sweep runs.
    /// </summary>
    public static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    /// <summary>
    /// Long enough for the event store and the provider projections to be up, short enough that a
    /// deployment whose providers have no catalog gets one within a minute of starting.
    /// </summary>
    public static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Runs one sweep, for a caller that wants the pass to happen now rather than on the cadence.
    /// </summary>
    /// <param name="cancellationToken">Cancels the sweep.</param>
    /// <returns>Awaitable task.</returns>
    public Task RunOnce(CancellationToken cancellationToken) => Sweep(cancellationToken);

    /// <inheritdoc/>
    /// <remarks>
    /// A sweep that could not run leaves every catalog exactly as it was and the next tick tries
    /// again, so a failure is logged rather than allowed to end the service. Letting it escape would
    /// stop the host silently, which is the one outcome worse than a stale catalog.
    /// </remarks>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(StartupDelay, timeProvider, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        using var timer = new PeriodicTimer(Interval, timeProvider);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Sweep(stoppingToken);
            }
            catch (Exception exception)
            {
                logger.CouldNotRunCatalogPass(exception);
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken))
                {
                    return;
                }
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    async Task Sweep(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var services = scope.ServiceProvider;

        var providers = await services.GetRequiredService<IMongoCollection<AIProvider>>()
            .Find(FilterDefinition<AIProvider>.Empty)
            .ToListAsync(cancellationToken);

        var due = providers.Where(IsDue).ToArray();
        if (due.Length == 0)
        {
            logger.EveryCatalogCurrent(providers.Count);
            return;
        }

        var commandPipeline = services.GetRequiredService<ICommandPipeline>();
        using var systemScope = services.GetRequiredService<ISystemExecution>().AsSystem();

        foreach (var provider in due)
        {
            await commandPipeline.ExecuteAndReport(new RefreshAvailableModels(provider.Id), logger);
        }

        logger.AskedProvidersForCatalogs(due.Length, providers.Count);
    }

    bool IsDue(AIProvider provider) =>
        provider.ModelsDiscoveredAt == default || provider.ModelsDiscoveredAt + StaleAfter <= timeProvider.GetUtcNow();
}

/// <summary>
/// Log messages for <see cref="AIProviderModelCatalogPass"/>.
/// </summary>
internal static partial class AIProviderModelCatalogPassLog
{
    [LoggerMessage(LogLevel.Warning, "The AI provider model catalog pass could not run")]
    internal static partial void CouldNotRunCatalogPass(this ILogger logger, Exception exception);

    [LoggerMessage(LogLevel.Debug, "Every one of the {ProviderCount} configured providers has a current model catalog")]
    internal static partial void EveryCatalogCurrent(this ILogger logger, int providerCount);

    [LoggerMessage(LogLevel.Information, "Asked {AskedCount} of {ProviderCount} configured providers for their model catalogs")]
    internal static partial void AskedProvidersForCatalogs(this ILogger logger, int askedCount, int providerCount);
}

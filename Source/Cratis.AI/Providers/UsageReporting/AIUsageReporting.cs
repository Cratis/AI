// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Cratis.AI.Abstractions;
using Cratis.Chronicle;
using Cratis.Types;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// Defines the system that answers a configured provider's vendor-reported usage report.
/// </summary>
public interface IAIUsageReporting
{
    /// <summary>
    /// Gets a configured provider's vendor-reported usage report for the trailing 30 days.
    /// </summary>
    /// <param name="providerId">The provider to ask.</param>
    /// <returns>The usage report.</returns>
    Task<AIProviderUsageReport> For(AIProviderId providerId);

    /// <summary>
    /// Gets vendor-reported usage reports for several providers at once - the pool-wide entry point
    /// capacity-aware selection can refresh every member through before ranking them. Fans the
    /// individual <see cref="For"/> calls out concurrently, each bounded by
    /// <paramref name="perProviderTimeout"/> so one slow or unreachable vendor never holds up the
    /// others, or the caller: a provider whose report does not answer in time is reported as
    /// <see cref="AIUsageReportAvailability.Unreachable"/> for this call, exactly as if it had failed
    /// outright.
    /// </summary>
    /// <param name="providerIds">The providers to ask.</param>
    /// <param name="perProviderTimeout">How long a single provider's report may take before it is reported as unreachable for this call.</param>
    /// <returns>The usage reports, keyed by provider.</returns>
    Task<IReadOnlyDictionary<AIProviderId, AIProviderUsageReport>> ForMany(IReadOnlyCollection<AIProviderId> providerIds, TimeSpan perProviderTimeout);
}

/// <summary>
/// Represents an implementation of <see cref="IAIUsageReporting"/> - resolves the provider, reveals its
/// stored usage Admin API key at the moment it is spent and asks the vendor's own
/// <see cref="ICanReportAIUsage"/>. A vendor report is allowed to throw - this orchestrator is the
/// single place that catches it and turns it into <see cref="AIUsageReportAvailability.Unreachable"/>,
/// so the reporters themselves stay simple. Ported from Direct's
/// <c>AIProviders.UsageReporting.AIUsageReporting</c> (migration-status.md, "Usage reporting").
/// </summary>
/// <param name="eventStore">The <see cref="IEventStore"/> the provider is resolved from.</param>
/// <param name="revealer">The <see cref="ISecretRevealer"/> the stored usage key is revealed through.</param>
/// <param name="reporters">Every discovered <see cref="ICanReportAIUsage"/>, one per <see cref="AIProviderType"/> that supports it.</param>
/// <param name="logger">The logger.</param>
public class AIUsageReporting(
    IEventStore eventStore,
    ISecretRevealer revealer,
    IInstancesOf<ICanReportAIUsage> reporters,
    ILogger<AIUsageReporting> logger) : IAIUsageReporting
{
    static readonly IEnumerable<AIProviderUsageDay> _noTokenUsage = [];
    static readonly IEnumerable<AIProviderCostDay> _noCosts = [];

    /// <inheritdoc/>
    public async Task<AIProviderUsageReport> For(AIProviderId providerId)
    {
        var provider = await eventStore.ReadModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
        if (provider is null)
        {
            logger.UnknownConfiguredProvider(providerId);
            return new(providerId, AIUsageReportAvailability.NotSupportedForVendor, _noTokenUsage, _noCosts);
        }

        var reporter = reporters.FirstOrDefault(candidate => candidate.Type == provider.Type);
        if (reporter is null)
        {
            return new(providerId, AIUsageReportAvailability.NotSupportedForVendor, _noTokenUsage, _noCosts);
        }

        if (provider.UsageApiKey.Equals(AIProviderApiKey.NotSet))
        {
            return new(providerId, AIUsageReportAvailability.NoCredentialConfigured, _noTokenUsage, _noCosts);
        }

        try
        {
            var revealed = provider with { UsageApiKey = (AIProviderApiKey)await revealer.Reveal(provider.UsageApiKey.Value) };
            var data = await reporter.ReportFor(revealed);
            return new(providerId, AIUsageReportAvailability.Available, data.TokenUsage, data.Costs);
        }
        catch (Exception exception) when (exception
            is HttpRequestException
            or OperationCanceledException
            or JsonException)
        {
            logger.CouldNotReadUsageReport(exception, providerId, provider.Type);
            return new(providerId, AIUsageReportAvailability.Unreachable, _noTokenUsage, _noCosts);
        }
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyDictionary<AIProviderId, AIProviderUsageReport>> ForMany(IReadOnlyCollection<AIProviderId> providerIds, TimeSpan perProviderTimeout)
    {
        var ids = providerIds.Distinct().ToList();
        var reports = await Task.WhenAll(ids.Select(id => ForWithTimeout(id, perProviderTimeout)));
        return ids.Zip(reports, (id, report) => (id, report)).ToDictionary(pair => pair.id, pair => pair.report);
    }

    async Task<AIProviderUsageReport> ForWithTimeout(AIProviderId providerId, TimeSpan timeout)
    {
        // The vendor call itself takes no cancellation token, so this does not abort the in-flight
        // request - it only stops this refresh from waiting on it. The request either finishes on its
        // own later with nothing observing the result, or the vendor's own HTTP timeout ends it.
        var reportTask = For(providerId);
        var completed = await Task.WhenAny(reportTask, Task.Delay(timeout));
        if (completed != reportTask)
        {
            logger.UsageReportTimedOut(providerId, timeout);
            return new(providerId, AIUsageReportAvailability.Unreachable, _noTokenUsage, _noCosts);
        }

        return await reportTask;
    }
}

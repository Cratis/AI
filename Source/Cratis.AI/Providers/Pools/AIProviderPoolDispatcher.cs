// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools.Listing;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// Dispatches a completion across a pool of providers, failing over on a transient failure. See
/// <see cref="AIProviderPoolDispatcher"/>.
/// </summary>
public interface IAIProviderPoolDispatcher
{
    /// <summary>
    /// Asks the pool to complete a prompt, trying each member in <see cref="PoolMemberSelector.Candidates"/>
    /// order until one succeeds or fails permanently, or every member has been tried.
    /// </summary>
    /// <param name="prompt">The prompt.</param>
    /// <param name="pool">The pool's members.</param>
    /// <param name="configuredProviders">Every configured provider the pool's members might name, keyed by id - a member naming one missing from this is skipped.</param>
    /// <param name="model">The model to run the completion on.</param>
    /// <param name="effort">The reasoning effort to run the completion at.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/> the last member tried settled on.</returns>
    Task<LanguageModelResult> Complete(
        string prompt,
        IEnumerable<AIProviderPoolMember> pool,
        IReadOnlyDictionary<AIProviderId, ConfiguredAIProvider> configuredProviders,
        ModelName model,
        Effort effort,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Dispatches a completion to a pool of providers, failing over to the next member in
/// <see cref="PoolMemberSelector.Candidates"/> order when the one it just tried answers with a
/// transient failure (a 429, most commonly a member's own quota, or a 5xx) rather than surfacing it
/// or retrying the same exhausted member (Cratis/AI#337). A member already known, from its own
/// last-reported quota headers, to be exhausted is skipped before it is ever called - not learned
/// about only after a wasted round trip and a 429.
/// </summary>
/// <param name="clients">Every registered <see cref="IAIProviderClient"/> - one per vendor, matched by <see cref="ConfiguredAIProvider.Type"/>.</param>
/// <param name="providerBurn">What each provider has burnt recently - the facts <see cref="PoolMemberSelector"/> orders candidates by.</param>
/// <param name="quotaTracker">What each provider's own responses most recently reported about its remaining quota.</param>
/// <param name="logger">The logger.</param>
public class AIProviderPoolDispatcher(
    IEnumerable<IAIProviderClient> clients,
    IProviderBurn providerBurn,
    IAIProviderQuotaTracker quotaTracker,
    ILogger<AIProviderPoolDispatcher> logger) : IAIProviderPoolDispatcher
{
    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(
        string prompt,
        IEnumerable<AIProviderPoolMember> pool,
        IReadOnlyDictionary<AIProviderId, ConfiguredAIProvider> configuredProviders,
        ModelName model,
        Effort effort,
        CancellationToken cancellationToken = default)
    {
        var burn = await providerBurn.TrailingWeek(cancellationToken);

        // This dispatcher knows nothing about provider failures or usage ceilings, so it ranks on
        // burn alone. The empty maps say "no information", which the selector treats as neutral
        // rather than as a measured zero.
        var ordered = PoolMemberSelector.Candidates(
            pool,
            PoolSelectionData.Nothing with
            {
                RecentTokensByProvider = burn.Tokens,
                RecentJobsByProvider = burn.Sessions
            }).ToList();

        if (ordered.Count == 0)
        {
            return LanguageModelResult.Failure("The pool has no members");
        }

        // Skip a member already known to be exhausted from its own last-reported quota - but only
        // when that leaves at least one candidate: a known-exhausted reading can itself be stale
        // (the vendor's own window may have already rolled over since the last call), and refusing
        // to even attempt a whole pool because every reading happens to be stale would be worse than
        // the wasted round trip a wrong skip costs.
        var reachable = ordered.Where(member => !quotaTracker.IsKnownExhausted(member.ProviderId)).ToList();
        var candidates = reachable.Count > 0 ? reachable : ordered;

        LanguageModelResult? last = null;
        foreach (var member in candidates)
        {
            if (!configuredProviders.TryGetValue(member.ProviderId, out var provider))
            {
                logger.PoolMemberNotConfigured(member.ProviderId);
                continue;
            }

            var client = clients.FirstOrDefault(candidate => candidate.Type == provider.Type);
            if (client is null)
            {
                logger.NoClientForProviderType(member.ProviderId, provider.Type);
                continue;
            }

            var result = await client.Complete(prompt, provider, model, effort, cancellationToken);
            if (result.Succeeded || !result.IsTransient)
            {
                return result;
            }

            logger.FailingOverToNextPoolMember(member.ProviderId, result.FailureReason);
            last = result;
        }

        return last ?? LanguageModelResult.Failure("No pool member could be reached");
    }
}

/// <summary>
/// Log messages for <see cref="AIProviderPoolDispatcher"/>.
/// </summary>
internal static partial class AIProviderPoolDispatcherLog
{
    [LoggerMessage(LogLevel.Warning, "Pool member {ProviderId} has no configured provider - skipping it")]
    internal static partial void PoolMemberNotConfigured(this ILogger logger, AIProviderId providerId);

    [LoggerMessage(LogLevel.Warning, "No registered IAIProviderClient for pool member {ProviderId}'s vendor {Type} - skipping it")]
    internal static partial void NoClientForProviderType(this ILogger logger, AIProviderId providerId, AIProviderType type);

    [LoggerMessage(LogLevel.Warning, "Provider {ProviderId} failed transiently ({Reason}) - failing over to the next pool member")]
    internal static partial void FailingOverToNextPoolMember(this ILogger logger, AIProviderId providerId, string reason);
}

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
/// about only after a wasted round trip and a 429. So is a member with a rate limit recorded against
/// it (<see cref="ConfiguredAIProvider.RateLimitedUntil"/>) that has not lifted yet - the same check
/// <see cref="ProviderAwareLanguageModel"/> makes.
/// </summary>
/// <remarks>
/// Does not consult <see cref="Capacity.IAIProviderCapacities"/>,
/// which reads the caller's tenant; a caller that wants headroom-aware ranking dispatches through
/// <see cref="ProviderAwareLanguageModel"/>. For the same reason it does not park a member that ran
/// out of quota: recording a rate limit is tenant-scoped, so it only fails over. A caller that needs
/// the exhausted provider skipped on later calls dispatches through
/// <see cref="ProviderAwareLanguageModel"/>, which parks it.
/// </remarks>
/// <param name="clients">Every registered <see cref="IAIProviderClient"/> - one per vendor, matched by <see cref="ConfiguredAIProvider.Type"/>.</param>
/// <param name="providerBurn">What each provider has burnt recently - the facts <see cref="PoolMemberSelector"/> orders candidates by.</param>
/// <param name="quotaTracker">What each provider's own responses most recently reported about its remaining quota.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> a recorded rate limit is checked against.</param>
/// <param name="logger">The logger.</param>
/// <param name="memberAccess">Checks fresh access for each attempt; absent means denied.</param>
public class AIProviderPoolDispatcher(
    IEnumerable<IAIProviderClient> clients,
    IProviderBurn providerBurn,
    IAIProviderQuotaTracker quotaTracker,
    TimeProvider timeProvider,
    ILogger<AIProviderPoolDispatcher> logger,
    IProviderMemberAccess? memberAccess = null) : IAIProviderPoolDispatcher
{
    /// <summary>
    /// Initializes a new instance of the <see cref="AIProviderPoolDispatcher"/> class measuring
    /// recorded rate limits against the system clock - kept so existing callers that construct it
    /// directly keep compiling.
    /// </summary>
    /// <param name="clients">Every registered <see cref="IAIProviderClient"/>.</param>
    /// <param name="providerBurn">What each provider has burnt recently.</param>
    /// <param name="quotaTracker">What each provider's own responses most recently reported about its remaining quota.</param>
    /// <param name="logger">The logger.</param>
    /// <param name="memberAccess">Checks fresh access for each attempt; absent means denied.</param>
    public AIProviderPoolDispatcher(
        IEnumerable<IAIProviderClient> clients,
        IProviderBurn providerBurn,
        IAIProviderQuotaTracker quotaTracker,
        ILogger<AIProviderPoolDispatcher> logger,
        IProviderMemberAccess? memberAccess = null)
        : this(clients, providerBurn, quotaTracker, TimeProvider.System, logger, memberAccess)
    {
    }

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

        ordered = await AccessibleMembers(ordered);
        if (ordered.Count == 0)
        {
            return LanguageModelResult.Failure("Access to every available pool member is denied for the work initiator");
        }

        // Skip a member already known to be exhausted from its own last-reported quota - but only
        // when that leaves at least one candidate: a known-exhausted reading can itself be stale
        // (the vendor's own window may have already rolled over since the last call), and refusing
        // to even attempt a whole pool because every reading happens to be stale would be worse than
        // the wasted round trip a wrong skip costs.
        var reachable = ordered.Where(member => !quotaTracker.IsKnownExhausted(member.ProviderId)).ToList();
        var candidates = reachable.Count > 0 ? reachable : ordered;

        return await CompleteCandidates(candidates, new(prompt, configuredProviders, model, effort), cancellationToken);
    }

    async Task<LanguageModelResult> CompleteCandidates(
        IEnumerable<AIProviderPoolMember> candidates, PoolCompletion request, CancellationToken cancellationToken)
    {
        var now = timeProvider.GetUtcNow();
        var progress = new CompletionProgress();
        foreach (var member in candidates)
        {
            var attempt = await CompleteMember(member.ProviderId, request, now, cancellationToken);
            progress.AnyAccessDenied |= attempt.AccessDenied;
            progress.AnyRateLimited |= attempt.RateLimited;
            if (attempt.Result is not { } result) continue;

            progress.Tried.Add(member.ProviderId);
            if (IsFinal(result)) return result;
            RememberRetry(progress, member.ProviderId, result);
        }

        return Exhausted(progress);
    }

    async Task<MemberCompletion> CompleteMember(
        AIProviderId providerId, PoolCompletion request, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (!request.ConfiguredProviders.TryGetValue(providerId, out var provider))
        {
            logger.PoolMemberNotConfigured(providerId);
            return new(null);
        }

        if (!await HasAccess(providerId)) return new(null, AccessDenied: true);

        if (provider.RateLimitedUntil > now)
        {
            logger.PoolMemberRateLimited(providerId, provider.RateLimitedUntil);
            return new(null, RateLimited: true);
        }

        var client = clients.FirstOrDefault(candidate => candidate.Type == provider.Type);
        if (client is null)
        {
            logger.NoClientForProviderType(providerId, provider.Type);
            return new(null);
        }

        return new(await client.Complete(request.Prompt, provider, request.Model, request.Effort, cancellationToken));
    }

    static bool IsFinal(LanguageModelResult result)
    {
        if (result.Succeeded) return true;
        return !result.IsTransient && !result.IsQuotaExhausted;
    }

    void RememberRetry(CompletionProgress progress, AIProviderId providerId, LanguageModelResult result)
    {
        // A spent quota fails over exactly like a transient failure - the same prompt goes to the
        // next member - but is remembered, so an exhausted pool says which members ran out.
        if (result.IsQuotaExhausted)
        {
            logger.PoolMemberQuotaExhausted(providerId, result.FailureReason);
            progress.OutOfQuota.Add(providerId);
        }
        else
        {
            logger.FailingOverToNextPoolMember(providerId, result.FailureReason);
            progress.AnyTransient = true;
        }

        progress.Last = result;
    }

    static LanguageModelResult Exhausted(CompletionProgress progress)
    {
        if (progress.OutOfQuota.Count > 0)
        {
            var reason = $"No pool member could serve this completion: the pool is exhausted. Tried {string.Join(", ", progress.Tried)}; out of quota: {string.Join(", ", progress.OutOfQuota)}. Last failure: {progress.Last!.FailureReason}";
            return progress.AnyTransient || progress.AnyRateLimited
                ? LanguageModelResult.TransientFailure(reason)
                : LanguageModelResult.QuotaExhausted(reason);
        }

        return progress.Last ?? Unavailable(progress.AnyAccessDenied, progress.AnyRateLimited);
    }

    static LanguageModelResult Unavailable(bool accessDenied, bool rateLimited)
    {
        if (accessDenied) return LanguageModelResult.Failure("Access to every available pool member is denied for the work initiator");
        return rateLimited
            ? LanguageModelResult.TransientFailure("Every reachable pool member is over its own usage limit")
            : LanguageModelResult.Failure("No pool member could be reached");
    }

    async Task<List<AIProviderPoolMember>> AccessibleMembers(IEnumerable<AIProviderPoolMember> members)
    {
        var allowed = new List<AIProviderPoolMember>();
        foreach (var member in members)
        {
            if (await HasAccess(member.ProviderId)) allowed.Add(member);
        }
        return allowed;
    }

    async Task<bool> HasAccess(AIProviderId provider)
    {
        if (memberAccess is not null && await memberAccess.IsAllowed(provider)) return true;
        logger.PoolMemberAccessDenied(provider);
        return false;
    }

    sealed record PoolCompletion(string Prompt, IReadOnlyDictionary<AIProviderId, ConfiguredAIProvider> ConfiguredProviders, ModelName Model, Effort Effort);

    sealed record MemberCompletion(LanguageModelResult? Result, bool AccessDenied = false, bool RateLimited = false);

    sealed class CompletionProgress
    {
        public List<AIProviderId> Tried { get; } = [];
        public List<AIProviderId> OutOfQuota { get; } = [];
        public LanguageModelResult? Last { get; set; }
        public bool AnyAccessDenied { get; set; }
        public bool AnyRateLimited { get; set; }
        public bool AnyTransient { get; set; }
    }
}

/// <summary>
/// Log messages for <see cref="AIProviderPoolDispatcher"/>.
/// </summary>
internal static partial class AIProviderPoolDispatcherLog
{
    [LoggerMessage(LogLevel.Warning, "Access to pool member {ProviderId} is denied for the work initiator - skipping it")]
    internal static partial void PoolMemberAccessDenied(this ILogger logger, AIProviderId providerId);

    [LoggerMessage(LogLevel.Warning, "Pool member {ProviderId} has no configured provider - skipping it")]
    internal static partial void PoolMemberNotConfigured(this ILogger logger, AIProviderId providerId);

    [LoggerMessage(LogLevel.Warning, "No registered IAIProviderClient for pool member {ProviderId}'s vendor {Type} - skipping it")]
    internal static partial void NoClientForProviderType(this ILogger logger, AIProviderId providerId, AIProviderType type);

    [LoggerMessage(LogLevel.Information, "Pool member {ProviderId} is over its own usage limit until {Until:O} - skipping it")]
    internal static partial void PoolMemberRateLimited(this ILogger logger, AIProviderId providerId, DateTimeOffset until);

    [LoggerMessage(LogLevel.Warning, "Provider {ProviderId} is out of quota ({Reason}) - failing over to the next pool member")]
    internal static partial void PoolMemberQuotaExhausted(this ILogger logger, AIProviderId providerId, string reason);

    [LoggerMessage(LogLevel.Warning, "Provider {ProviderId} failed transiently ({Reason}) - failing over to the next pool member")]
    internal static partial void FailingOverToNextPoolMember(this ILogger logger, AIProviderId providerId, string reason);
}

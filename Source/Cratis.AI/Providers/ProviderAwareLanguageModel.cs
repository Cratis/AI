// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
using Cratis.AI.Agents;
using Cratis.AI.Agents.Skills;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.Pools.Listing;
using Cratis.AI.Providers.RateLimiting;
using Cratis.AI.Providers.UsageReporting;
using Cratis.Types;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using ConfiguredAgent = Cratis.AI.Agents.Listing.Agent;

namespace Cratis.AI.Providers;

/// <summary>
/// The <see cref="ILanguageModel"/> every completion goes through. Resolution for the calling
/// purpose's agent: an explicit provider dispatches straight to that provider's
/// <see cref="IAIProviderClient"/>; a pool picks the member with the least tokens burnt over the
/// trailing week (<see cref="PoolMemberSelector"/> - tracked per provider via
/// <c>LanguageModels.RecordingUsage.LanguageModelUsageRecorded</c>) and dispatches to it with
/// the member's own model, skipping members that resolve dead (removed provider, no matching client,
/// or a saturated <paramref name="providerConcurrencyGate"/>).
/// <para>
/// When nothing resolves, the completion <b>fails</b> and says so. There is deliberately no fallback:
/// an agent runs on the provider it is configured with or it does not run, the same rule the work
/// dispatcher already applies to worker dispatch. The global <c>Direct:LanguageModel</c>
/// configuration this used to fall back to is gone - it existed to keep a provider-less deployment
/// working, but in practice it turned every misconfiguration into a silent failure against an
/// unconfigured key, which is precisely how a chat outage survived two rounds of investigation
/// (issue #103).
/// </para>
/// Every dispatch is bounded by <paramref name="providerConcurrencyGate"/>, independently per
/// provider, so a busy provider never throttles an unrelated idle one.
/// </summary>
/// <param name="providerClients">Every discovered <see cref="IAIProviderClient"/>, one per <see cref="AIProviderType"/> - convention-discovered, so a new vendor client needs no registration.</param>
/// <param name="compatibility">Checks that the resolved provider can serve the calling agent.</param>
/// <param name="readModels">The <see cref="IReadModels"/> the role, provider and pool are resolved from - injected directly rather than reached through <c>IEventStore.ReadModels</c>, which read the role back with its <c>ProviderId</c> silently null and so sent every chat reply down the legacy fallback (issue #103). The <c>Work.Scheduling.WorkDispatcher</c> resolves the very same read model this way and has always seen the provider.</param>
/// <param name="providerBurn">The recent burn per provider the least-burnt pick keys off.</param>
/// <param name="providerUsageLevels">Refreshes every pool member's usage level ahead of selection, so capacity-aware ranking uses current numbers (issue #1061).</param>
/// <param name="recentProviderFailures">The recent-failure memory <see cref="Pools.PoolMemberSelector"/> ranks pool members by, and where a transient real-call failure is recorded (issue #1060).</param>
/// <param name="providerConcurrencyGate">Bounds concurrent calls to each configured provider, independently.</param>
/// <param name="defaultAgentModes">Says what a purpose is invoked as when no agent claims it.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> a 429/quota transient failure is recorded against its provider through, so the pool stops picking it before the cooldown lifts (issue #1060).</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> the rate-limit cooldown and the rate-limit consult check are measured against.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> the completion deadline and rate-limit cooldown are read from.</param>
/// <param name="logger">The logger - every resolution miss is logged here, so a completion that failed because of configuration is never indistinguishable from one that failed at the vendor.</param>
public class ProviderAwareLanguageModel(
    IInstancesOf<IAIProviderClient> providerClients,
    IAgentProviderCompatibility compatibility,
    IReadModels readModels,
    IProviderBurn providerBurn,
    IProviderUsageLevels providerUsageLevels,
    IRecentProviderFailures recentProviderFailures,
    IProviderConcurrencyGate providerConcurrencyGate,
    IDefaultAgentInvocationModes defaultAgentModes,
    ICommandPipeline commandPipeline,
    TimeProvider timeProvider,
    IOptions<AIProviderOptions> options,
    ILogger<ProviderAwareLanguageModel> logger) : ILanguageModel
{
    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(string prompt, LanguageModelPurpose purpose, CancellationToken cancellationToken = default)
    {
        // Bounds the whole completion - not just the vendor HTTP call, everything below - so a vendor
        // that stops responding without erroring degrades into an ordinary failed completion instead
        // of wedging the caller (often a Chronicle reactor, whose single-threaded observer stalls
        // behind a call that never returns) forever.
        var callerCancellationToken = cancellationToken;
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        deadline.CancelAfter(options.Value.CompletionTimeout);
        cancellationToken = deadline.Token;

        var role = await ConfiguredAgent.For(readModels, purpose);

        // What was configured on the agent travels into the completion, exactly as it does into a
        // worker container's prompt. Without this, skills only reached the agents that happen to run
        // as a job - so configuring one on a chat-completion agent quietly did nothing.
        prompt = AgentSkillPrompt.Ahead(prompt, role?.Skills);

        var hasPool = role?.PoolId is { } configuredPool && !configuredPool.Equals(AIProviderPoolId.NotSet);
        var hasProvider = role?.ProviderId is { } configuredProvider && !configuredProvider.Equals(AIProviderId.NotSet);

        var effort = role?.Effort ?? Effort.High;

        // The role's capability tier (#865) - the provider each path below resolves to translates it
        // into the concrete model it offers for that tier.
        var tier = role?.Tier ?? ModelTier.Balanced;

        var poolExhaustedTransiently = false;
        try
        {
            if (hasPool)
            {
                var (result, exhaustedTransiently) = await CompleteThroughPool(prompt, purpose, role!.PoolId!, tier, effort, cancellationToken);
                if (result is not null)
                {
                    return result;
                }

                poolExhaustedTransiently = exhaustedTransiently;
            }

            if (hasProvider)
            {
                var result = await CompleteThroughProvider(prompt, purpose, role!.ProviderId!, tier, effort, cancellationToken);
                if (result is not null)
                {
                    return result;
                }
            }
        }
        catch (OperationCanceledException) when (!callerCancellationToken.IsCancellationRequested)
        {
            // The linked token above can be canceled for two different reasons that look identical
            // from here on out - the caller's own token, or CompletionTimeout simply running out - and
            // only the caller's own token is genuine cancellation. Checking the *original*, un-linked
            // token is what tells them apart: it is only set when the caller asked to stop, never by
            // CancelAfter. A deadline expiry degrades into the ordinary failed completion the
            // CompletionTimeout doc comment promises, exactly like a vendor answering with an error
            // would; true caller cancellation still propagates, unchanged.
            logger.CompletionTimedOut(purpose, options.Value.CompletionTimeout);
            return LanguageModelResult.TransientFailure($"The completion did not finish within {options.Value.CompletionTimeout}");
        }

        if (!hasPool && !hasProvider)
        {
            logger.AgentNamesNoProvider(purpose, role is null);
            return LanguageModelResult.Failure(
                $"The {purpose.Value} agent has no AI provider or pool configured. Configure one in Settings under Agents.");
        }

        // Everything the agent named resolved dead - the specific reason is already logged by
        // whichever step gave up. When the pool ran out of members purely because of transient
        // failures - never because the request itself was wrong - this is worth
        // ManagedLanguageModel's whole-call retry: burn and rate-limit state can look different by
        // the time it tries again, which a same-provider hammering retry never gave the pool a chance
        // to benefit from (issue #1060).
        logger.NothingTheAgentNamedCouldServe(purpose);
        var reason = $"The AI provider configured for the {purpose.Value} agent could not serve this request. See the log for which step gave up.";
        return poolExhaustedTransiently ? LanguageModelResult.TransientFailure(reason) : LanguageModelResult.Failure(reason);
    }

    static Dictionary<AIProviderId, long> RemainingCapacityByProvider(IReadOnlyDictionary<AIProviderId, ProviderUsageLevel> usageLevels) =>
        usageLevels
            .Where(pair => pair.Value.RemainingCapacity is not null)
            .ToDictionary(pair => pair.Key, pair => pair.Value.RemainingCapacity!.Value);

    async Task<(LanguageModelResult? Result, bool ExhaustedTransiently)> CompleteThroughPool(string prompt, LanguageModelPurpose purpose, AIProviderPoolId poolId, ModelTier tier, Effort effort, CancellationToken cancellationToken)
    {
        var pool = await readModels.GetInstanceById<AIProviderPool>((EventSourceId)poolId);
        if (pool is null)
        {
            logger.PoolNotConfigured(poolId);
            return (null, false);
        }

        var members = pool.Members?.ToList();
        if (members is null || members.Count == 0)
        {
            logger.PoolHasNoMembers(poolId);
            return (null, false);
        }

        var burn = await providerBurn.TrailingWeek(cancellationToken);
        var usageLevels = await providerUsageLevels.RefreshMany([.. members.Select(member => member.ProviderId)], cancellationToken);
        var remainingCapacity = RemainingCapacityByProvider(usageLevels);
        var selection = new PoolSelectionData(burn.Tokens, burn.Sessions, recentProviderFailures.CountsSince(options.Value.RecentFailureWindow), remainingCapacity);

        var dispatch = await PoolDispatcher.Dispatch(
            members,
            selection,
            recentProviderFailures,
            $"No member of pool {poolId} could serve this completion",
            (member, ct) => AttemptCompletion(prompt, purpose, member, tier, effort, ct),
            cancellationToken);

        switch (dispatch.Outcome)
        {
            case PoolDispatchOutcome.Succeeded:
            case PoolDispatchOutcome.Stopped:
                // Succeeded hands back what was served; Stopped means a permanent failure said
                // trying the rest of the pool could not help - either way, this is the pool's final
                // answer and there is nothing transient about it.
                return (dispatch.Value, false);

            default:
                logger.PoolExhausted(poolId);
                return (null, dispatch.AnyTransientFailure);
        }
    }

    async Task<PoolAttempt<LanguageModelResult>> AttemptCompletion(string prompt, LanguageModelPurpose purpose, AIProviderPoolMember member, ModelTier tier, Effort effort, CancellationToken cancellationToken)
    {
        var result = await CompleteThroughProvider(prompt, purpose, member.ProviderId, tier, effort, cancellationToken);
        if (result is null)
        {
            // Never reached a real call - unconfigured, incompatible, saturated, rate-limited. Not
            // worth remembering as a failure; the reason is already logged by whichever check gave up.
            return PoolAttempt<LanguageModelResult>.Skipped($"AI provider {member.ProviderId} could not be resolved");
        }

        if (result.Succeeded)
        {
            return PoolAttempt<LanguageModelResult>.Succeeded(result);
        }

        return result.IsTransient
            ? PoolAttempt<LanguageModelResult>.TransientFailure(result.FailureReason)
            : PoolAttempt<LanguageModelResult>.PermanentFailure(result, result.FailureReason);
    }

    async Task<LanguageModelResult?> CompleteThroughProvider(string prompt, LanguageModelPurpose purpose, AIProviderId providerId, ModelTier tier, Effort effort, CancellationToken cancellationToken)
    {
        var provider = await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)providerId);
        if (provider is null)
        {
            logger.ProviderNotConfigured(providerId);
            return null;
        }

        if (!compatibility.Supports(purpose, provider.Type))
        {
            logger.ProviderDoesNotSatisfyAgentCapabilities(providerId, provider.Type, purpose);
            return null;
        }

        var client = providerClients.FirstOrDefault(candidate => candidate.Type == provider.Type);
        if (client is null)
        {
            logger.NoClientForProviderType(providerId, provider.Type);
            return null;
        }

        // The tier translates through the provider's own mapping, with the catalog the provider
        // actually published standing in for tiers the mapping leaves unset (#865, #1187).
        var resolvedModel = TierModelResolution.Resolve(provider.TierModels, provider.AvailableModels, tier);
        if (resolvedModel.Equals(ModelName.NotSet))
        {
            logger.NoModelResolved(providerId, provider.Type);
            return null;
        }

        var mode = defaultAgentModes.For(purpose);
        if (!AIModelCapabilities.Supports(mode, resolvedModel))
        {
            logger.ModelDoesNotSatisfyAgentCapabilities(providerId, resolvedModel, purpose);
            return null;
        }

        // A provider that turned work away over its own usage limit is not a usable pick until the
        // allowance has had time to come back - the same check ActingAgentResolver.ResolveProvider
        // already makes for work dispatch (issue #1060). Skipping it here, before spending a
        // concurrency slot on it, lets a pool move on to a member that still has capacity instead of
        // re-discovering the same 429 it already recorded.
        if (provider.RateLimitedUntil > timeProvider.GetUtcNow())
        {
            logger.ProviderRateLimited(providerId, provider.RateLimitedUntil);
            return null;
        }

        // Bounded per provider, independently of every other configured provider - a saturated slot
        // is treated the same as any other resolution failure (a pool moves on to its next member; a
        // direct provider falls through to the legacy configuration) rather than hanging this call.
        var slot = await providerConcurrencyGate.TryEnter(providerId, cancellationToken);
        if (slot is null)
        {
            logger.ProviderConcurrencyLimitTimedOut(providerId);
            return null;
        }

        using (slot)
        {
            // The stored key is protected at rest with the tenant's Vault-held encryption key (or is
            // a legacy plaintext value the protector passes through) - it is revealed only here, at
            // the moment it is spent, and the revealed value goes no further than the vendor call.
            var result = await client.Complete(prompt, provider, resolvedModel, effort, cancellationToken);
            result = result with { ProviderId = providerId };

            // The completion path has the vendor's actual status code, unlike a worker's failure
            // text - so a 429/quota transient failure is recorded against the provider here rather
            // than waiting for a worker to report the same thing in words (issue #1060).
            if (result.IsTransient && ProviderRateLimit.IsIndicatedBy(result.FailureReason))
            {
                await RecordRateLimit(providerId);
            }

            return result;
        }
    }

    async Task RecordRateLimit(AIProviderId providerId)
    {
        try
        {
            // Reported, never discarded. A dropped result here is not a lost log line - it is the
            // cooldown itself going missing, and the completion path then rediscovers the same 429 on
            // every attempt. Production spent a day at thirty rejected calls a minute against a
            // provider that had already said no, with nothing anywhere saying why the cooldown that
            // was supposed to stop it never took.
            await commandPipeline.ExecuteAndReport(
                new RecordProviderRateLimited(providerId, timeProvider.GetUtcNow().Add(options.Value.RateLimitCooldown)),
                logger);
        }
        catch (Exception exception)
        {
            // Losing the rate-limit record is not worth failing the caller's actual completion over -
            // the next attempt at this provider simply rediscovers the same 429.
            logger.CouldNotRecordRateLimit(exception, providerId);
        }
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers;

/// <summary>
/// Log messages for <see cref="ProviderAwareLanguageModel"/>.
/// </summary>
/// <remarks>
/// Every message here covers a case where an agent cannot be dispatched to the provider it names - a
/// real misconfiguration (nothing configured at all, a removed provider, no client for its vendor, a
/// read model that has not caught up yet). The completion fails rather than degrading into something
/// that works badly, so these messages are the record of *why* it failed: the caller only sees that
/// it did.
/// </remarks>
internal static partial class ProviderAwareLanguageModelLog
{
    [LoggerMessage(LogLevel.Warning, "An agent names AI provider {ProviderId} but no configured provider goes by that id - it may have been removed, or the read model has not caught up with a very recent change yet")]
    internal static partial void ProviderNotConfigured(this ILogger logger, AIProviderId providerId);

    [LoggerMessage(LogLevel.Warning, "An agent names AI provider {ProviderId} (vendor {ProviderType}) but no IAIProviderClient handles that vendor")]
    internal static partial void NoClientForProviderType(this ILogger logger, AIProviderId providerId, AIProviderType providerType);

    [LoggerMessage(LogLevel.Warning, "AI provider {ProviderId} (vendor {ProviderType}) does not satisfy the capabilities required by the {Purpose} agent")]
    internal static partial void ProviderDoesNotSatisfyAgentCapabilities(this ILogger logger, AIProviderId providerId, AIProviderType providerType, LanguageModelPurpose purpose);

    [LoggerMessage(LogLevel.Warning, "AI provider {ProviderId} (vendor {ProviderType}) has no model set on the agent and no built-in default for its vendor")]
    internal static partial void NoModelResolved(this ILogger logger, AIProviderId providerId, AIProviderType providerType);

    [LoggerMessage(LogLevel.Warning, "Model {Model} on AI provider {ProviderId} does not satisfy the capabilities required by the {Purpose} agent")]
    internal static partial void ModelDoesNotSatisfyAgentCapabilities(this ILogger logger, AIProviderId providerId, ModelName model, LanguageModelPurpose purpose);

    [LoggerMessage(LogLevel.Warning, "An agent names AI provider pool {PoolId} but no configured pool goes by that id - it may have been removed, or the read model has not caught up with a very recent change yet")]
    internal static partial void PoolNotConfigured(this ILogger logger, AIProviderPoolId poolId);

    [LoggerMessage(LogLevel.Warning, "AI provider pool {PoolId} has no members configured. Falling through to the agent's own provider, if it names one")]
    internal static partial void PoolHasNoMembers(this ILogger logger, AIProviderPoolId poolId);

    [LoggerMessage(LogLevel.Warning, "Every member of AI provider pool {PoolId} failed to resolve to a working provider. Falling through to the agent's own provider, if it names one")]
    internal static partial void PoolExhausted(this ILogger logger, AIProviderPoolId poolId);

    [LoggerMessage(LogLevel.Warning, "AI provider {ProviderId} is at its concurrency limit and no slot freed up within the configured wait timeout. Treated the same as any other resolution failure - a pool tries its next member, a directly named provider fails the completion")]
    internal static partial void ProviderConcurrencyLimitTimedOut(this ILogger logger, AIProviderId providerId);

    [LoggerMessage(LogLevel.Warning, "The {Purpose} agent names neither an AI provider nor a pool (agent missing entirely: {AgentMissing}), so there is nothing to run this completion on. Configure one in Settings under Agents")]
    internal static partial void AgentNamesNoProvider(this ILogger logger, LanguageModelPurpose purpose, bool agentMissing);

    [LoggerMessage(LogLevel.Warning, "Nothing the {Purpose} agent names could serve this completion - the step that gave up logged why just above")]
    internal static partial void NothingTheAgentNamedCouldServe(this ILogger logger, LanguageModelPurpose purpose);

    [LoggerMessage(LogLevel.Information, "AI provider {ProviderId} is over its own usage limit until {Until:O} - skipped rather than spending a call rediscovering the same limit")]
    internal static partial void ProviderRateLimited(this ILogger logger, AIProviderId providerId, DateTimeOffset until);

    [LoggerMessage(LogLevel.Warning, "Could not record that AI provider {ProviderId} is rate-limited - the completion itself still succeeded or failed on its own terms, but the next attempt may rediscover the same 429")]
    internal static partial void CouldNotRecordRateLimit(this ILogger logger, Exception exception, AIProviderId providerId);

    [LoggerMessage(LogLevel.Warning, "The {Purpose} completion did not finish within its {Timeout} deadline - treated as a transient failure rather than left to escape as an uncaught cancellation")]
    internal static partial void CompletionTimedOut(this ILogger logger, LanguageModelPurpose purpose, TimeSpan timeout);
}

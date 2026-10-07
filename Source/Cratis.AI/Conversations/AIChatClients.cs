// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Cratis.AI.Providers.Capacity;
using Cratis.AI.Providers.Pools;
using Cratis.AI.Providers.RateLimiting;
using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Usage;
using Microsoft.Extensions.AI;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Conversations;

/// <summary>
/// Represents an implementation of <see cref="IAIChatClients"/>.
/// </summary>
/// <param name="readModels">The <see cref="IReadModels"/> the agent, provider and pool are resolved from.</param>
/// <param name="compatibility">Checks that a provider can serve the agent.</param>
/// <param name="providerBurn">The recent burn per provider the least-burnt pick keys off.</param>
/// <param name="providerUsageLevels">Refreshes every pool member's usage level ahead of selection.</param>
/// <param name="providerCapacities">The headroom each pool member's vendor reports.</param>
/// <param name="recentProviderFailures">The recent-failure memory pool members are ranked by.</param>
/// <param name="providerConcurrencyGate">Bounds concurrent calls to each provider.</param>
/// <param name="chatClientFactory">Builds the vendor client for a chosen provider.</param>
/// <param name="agents">The configured agents, to attribute usage.</param>
/// <param name="agentExecution">Scopes usage recording to the calling agent.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> usage and rate limits are recorded through.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> cooldowns are measured against.</param>
/// <param name="options">The <see cref="AIProviderOptions"/>.</param>
/// <param name="loggerFactory">The logger factory.</param>
public class AIChatClients(
    IReadModels readModels,
    IAgentProviderCompatibility compatibility,
    IProviderBurn providerBurn,
    IProviderUsageLevels providerUsageLevels,
    IAIProviderCapacities providerCapacities,
    IRecentProviderFailures recentProviderFailures,
    IProviderConcurrencyGate providerConcurrencyGate,
    IProviderChatClientFactory chatClientFactory,
    IAIAgents agents,
    IAgentExecution agentExecution,
    ICommandPipeline commandPipeline,
    TimeProvider timeProvider,
    IOptions<AIProviderOptions> options,
    ILoggerFactory loggerFactory) : IAIChatClients
{
    /// <inheritdoc/>
    public IChatClient For(LanguageModelPurpose purpose)
    {
        var logger = loggerFactory.CreateLogger<PooledChatClient>();
        return new PooledChatClient(
            purpose,
            readModels,
            compatibility,
            providerBurn,
            providerUsageLevels,
            providerCapacities,
            recentProviderFailures,
            providerConcurrencyGate,
            chatClientFactory,
            agents,
            agentExecution,
            commandPipeline,
            new ProviderRateLimitRecorder(providerCapacities, commandPipeline, timeProvider, options, logger),
            timeProvider,
            options,
            logger);
    }
}

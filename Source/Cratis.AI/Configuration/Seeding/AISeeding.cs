// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.AI.Common;
using Cratis.AI.Providers;
using Cratis.AI.Providers.SettingTierModels;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Configuration.Seeding;

/// <summary>
/// Applies a <see cref="SeededOpenAIProvider"/> through the package's own commands - so validation,
/// credential protection and event pinning stay where they already are.
/// </summary>
/// <remarks>
/// <para>
/// A seed only ever creates. When the provider already exists nothing at all is sent, which is what
/// makes a restart a no-op and lets an administrator change the provider, its tier models or its
/// agents afterwards without the next start putting them back. Existence is read from the provider's
/// own stream through the passive <see cref="ConfiguredAIProvider"/>, never from a list read model
/// that may still be catching up. The agents and tier models are seeded only in the run that created
/// the provider, so they are not subject to that lag either.
/// </para>
/// <para>
/// A removed provider has no stream left to find, so it is seeded again on the next start. Remove the
/// seed from code once the provider is administered by hand.
/// </para>
/// </remarks>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> the commands are sent through.</param>
/// <param name="readModels">The <see cref="IReadModels"/> the provider's existence is read from.</param>
/// <param name="logger">The logger.</param>
public class AISeeding(ICommandPipeline commandPipeline, IReadModels readModels, ILogger<AISeeding> logger)
{
    /// <summary>
    /// Creates the seed's provider, tier models and agents when the provider does not exist yet.
    /// </summary>
    /// <param name="seed">The <see cref="SeededOpenAIProvider"/> to apply.</param>
    /// <returns><see langword="true"/> when the seed created the provider; <see langword="false"/> when it was skipped or failed.</returns>
    public async Task<bool> Apply(SeededOpenAIProvider seed)
    {
        if (string.IsNullOrWhiteSpace(seed.ApiKey))
        {
            logger.SeedHasNoApiKey(seed.Name);
            return false;
        }

        var id = seed.ProviderId;
        if (await readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id) is not null)
        {
            logger.SeedAlreadyApplied(seed.Name);
            return false;
        }

        var added = await commandPipeline.ExecuteAndReport(new AddSeededOpenAIProvider(id, seed.Name, seed.ApiKey), logger);
        if (!added.IsSuccess)
        {
            return false;
        }

        await SeedTierModels(seed, id);
        foreach (var agent in seed.Agents)
        {
            await commandPipeline.ExecuteAndReport(new ConfigureAgent(agent.Purpose, agent.Name, agent.Description, agent.Tier, ProviderId: id), logger);
        }

        logger.SeedApplied(seed.Name, seed.Agents.Count);
        return true;
    }

    async Task SeedTierModels(SeededOpenAIProvider seed, AIProviderId id)
    {
        if (seed.TierModels is { } tierModels)
        {
            await commandPipeline.ExecuteAndReport(new SetAIProviderTierModels(id, tierModels), logger);
        }
    }
}

/// <summary>
/// Log messages for <see cref="AISeeding"/>. None of them carry the API key.
/// </summary>
internal static partial class AISeedingLog
{
    [LoggerMessage(LogLevel.Warning, "Not seeding AI provider '{ProviderName}': no API key was supplied")]
    internal static partial void SeedHasNoApiKey(this ILogger logger, string providerName);

    [LoggerMessage(LogLevel.Debug, "AI provider '{ProviderName}' already exists - seed skipped")]
    internal static partial void SeedAlreadyApplied(this ILogger logger, string providerName);

    [LoggerMessage(LogLevel.Information, "Seeded AI provider '{ProviderName}' with {AgentCount} agent(s)")]
    internal static partial void SeedApplied(this ILogger logger, string providerName, int agentCount);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Configuration.Seeding;

/// <summary>
/// What applying a <see cref="SeededOpenAIProvider"/> came to.
/// </summary>
public enum SeedOutcome
{
    /// <summary>
    /// Nothing was sent - the seed has no API key.
    /// </summary>
    Skipped,

    /// <summary>
    /// A command was refused or failed - the seed is incomplete and worth another attempt.
    /// </summary>
    Failed,

    /// <summary>
    /// Every command was accepted. Whatever already existed was left exactly as it was.
    /// </summary>
    Completed
}

/// <summary>
/// Applies a <see cref="SeededOpenAIProvider"/> through the package's own commands - so validation,
/// credential protection and event pinning stay where they already are.
/// </summary>
/// <remarks>
/// <para>
/// A seed only ever creates. Each step is a create-once command that decides on the stream it would
/// append to (the passive <see cref="ConfiguredAIProvider"/>, the passive <see cref="SeededAgentPresence"/>)
/// and appends nothing when its part already exists - never a list read model that may still be
/// catching up. That makes a restart a no-op, lets an administrator change the provider, its tier
/// models or its agents afterwards without the next start putting them back, and lets a run that
/// stopped after creating the provider finish its tier models and agents later.
/// </para>
/// <para>
/// A removed provider has no stream left to find, so it is seeded again on the next start. Remove the
/// seed from code once the provider is administered by hand.
/// </para>
/// </remarks>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> the commands are sent through.</param>
/// <param name="logger">The logger.</param>
public class AISeeding(ICommandPipeline commandPipeline, ILogger<AISeeding> logger)
{
    /// <summary>
    /// Creates whatever part of the seed - provider, tier models, agents - does not exist yet.
    /// </summary>
    /// <param name="seed">The <see cref="SeededOpenAIProvider"/> to apply.</param>
    /// <returns>What it came to.</returns>
    public async Task<SeedOutcome> Apply(SeededOpenAIProvider seed)
    {
        if (string.IsNullOrWhiteSpace(seed.ApiKey))
        {
            logger.SeedHasNoApiKey(seed.Name);
            return SeedOutcome.Skipped;
        }

        foreach (var step in StepsFor(seed))
        {
            var result = await commandPipeline.ExecuteAndReport(step, logger);
            if (!result.IsSuccess)
            {
                logger.SeedIncomplete(seed.Name);
                return SeedOutcome.Failed;
            }
        }

        logger.SeedApplied(seed.Name, seed.Agents.Count);
        return SeedOutcome.Completed;
    }

    static IEnumerable<object> StepsFor(SeededOpenAIProvider seed)
    {
        var id = seed.ProviderId;
        yield return new AddSeededOpenAIProvider(id, seed.Name, seed.ApiKey);
        if (seed.TierModels is { } tierModels)
        {
            yield return new SeedAIProviderTierModels(id, tierModels);
        }

        foreach (var agent in seed.Agents)
        {
            yield return new SeedAgent(agent.Purpose, agent.Name, agent.Description, agent.Tier, id);
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

    [LoggerMessage(LogLevel.Warning, "AI provider seed '{ProviderName}' is incomplete: a step failed")]
    internal static partial void SeedIncomplete(this ILogger logger, string providerName);

    [LoggerMessage(LogLevel.Information, "AI provider '{ProviderName}' is seeded with {AgentCount} agent(s)")]
    internal static partial void SeedApplied(this ILogger logger, string providerName, int agentCount);
}

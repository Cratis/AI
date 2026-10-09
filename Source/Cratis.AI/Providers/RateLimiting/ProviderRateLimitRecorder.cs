// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers.Capacity;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.RateLimiting;

/// <summary>
/// Records that a provider turned work away over its usage limit, parking it until the limit lifts. The one
/// place this happens, shared by every path that calls a vendor directly - completions
/// (<see cref="ProviderAwareLanguageModel"/>) and conversational chat clients
/// (<see cref="Conversations.AIChatClients"/>).
/// </summary>
/// <param name="providerCapacities">The headroom each vendor reports - what a limit's expiry falls back to when the failure does not state one.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> the limit is recorded through.</param>
/// <param name="timeProvider">The <see cref="TimeProvider"/> the cooldown is measured against.</param>
/// <param name="options">The <see cref="AIProviderOptions"/> the cooldown is read from.</param>
/// <param name="logger">The logger a failure to record is reported to.</param>
public class ProviderRateLimitRecorder(
    IAIProviderCapacities providerCapacities,
    ICommandPipeline commandPipeline,
    TimeProvider timeProvider,
    IOptions<AIProviderOptions> options,
    ILogger logger)
{
    /// <summary>
    /// The longest a rate limit is recorded for from a reset read out of a failure's own text - a
    /// monthly allowance is the longest window any vendor meters, so a reset further out than this is
    /// more likely a misread than a fact, and is not trusted to park a provider for that long.
    /// </summary>
    static readonly TimeSpan _longestStatedReset = TimeSpan.FromDays(31);

    /// <summary>
    /// Records the rate limit a failure indicated against its provider.
    /// </summary>
    /// <param name="providerId">The provider that turned the call away.</param>
    /// <param name="reason">The failure text, read for a stated reset.</param>
    /// <returns>An awaitable task.</returns>
    public async Task Record(AIProviderId providerId, string reason)
    {
        try
        {
            // Parked until the limit actually lifts, when that is known - a weekly window resetting
            // in three days is not worth retrying every hour, spending a call or a whole worker
            // session each time. The stated reset in the failure itself wins; failing that, when the
            // vendor's own windows said the provider would be available again; never shorter than
            // the cooldown, which covers a limit nothing said anything about.
            var now = timeProvider.GetUtcNow();
            var cooldown = now.Add(options.Value.RateLimitCooldown);
            var availableAgain = ProviderRateLimit.ResetIndicatedBy(reason, now) ?? await AvailableAgainAt(providerId);
            if (availableAgain > now.Add(_longestStatedReset))
            {
                availableAgain = null;
            }

            var until = availableAgain > cooldown ? availableAgain.Value : cooldown;
            providerCapacities.Forget(providerId);

            // Reported, never discarded - a dropped result here is the cooldown itself going missing,
            // and the next attempts rediscover the same 429 over and over.
            await commandPipeline.ExecuteAndReport(new RecordProviderRateLimited(providerId, until), logger);
        }
        catch (Exception exception)
        {
            // Losing the rate-limit record is not worth failing the caller's actual call over -
            // the next attempt at this provider simply rediscovers the same 429.
            logger.CouldNotRecordRateLimit(exception, providerId);
        }
    }

    async Task<DateTimeOffset?> AvailableAgainAt(AIProviderId providerId)
    {
        var capacity = await providerCapacities.For(providerId);
        return capacity.AvailableAgainAt;
    }
}

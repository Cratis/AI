// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.Usage;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.LanguageModels;

/// <summary>
/// Wraps the configured <see cref="ILanguageModel"/> with the two concerns every caller needs and
/// none of them should have to remember: retrying a transient failure, and recording usage against
/// the agent serving the purpose. Concurrency bounding is a provider-resolution concern, one layer
/// down (plan Section 5.2 step 6) - not this wrapper's job. Registered as <see cref="ILanguageModel"/>
/// in place of the real provider, which every caller keeps depending on directly. Ported from
/// Direct's <c>LanguageModels.ManagedLanguageModel</c> (plan Section 5.2 step 7), rewired onto the
/// package's own <see cref="RecordAgentSessionUsage"/> and <see cref="IAgentExecution"/>.
/// </summary>
/// <param name="inner">The real provider to call - resolved and wired up explicitly rather than constructor-injected, so the container never has two competing <see cref="ILanguageModel"/> registrations to resolve between.</param>
/// <param name="commandPipeline">The <see cref="ICommandPipeline"/> usage is recorded through.</param>
/// <param name="agents">The <see cref="IAIAgents"/> lookup <see cref="IAgentExecution"/> resolves the acting agent through.</param>
/// <param name="agentExecution">The <see cref="IAgentExecution"/> scope that attributes the usage event to the agent serving the purpose.</param>
/// <param name="logger">The logger.</param>
/// <param name="delay">
/// Waits out a retry's backoff - <see cref="Task.Delay(TimeSpan, CancellationToken)"/> in production;
/// a spec substitutes an instant, assertable fake so proving the retry schedule never costs the suite
/// real wall-clock seconds.
/// </param>
public class ManagedLanguageModel(
    ILanguageModel inner,
    ICommandPipeline commandPipeline,
    IAIAgents agents,
    IAgentExecution agentExecution,
    ILogger<ManagedLanguageModel> logger,
    Func<TimeSpan, CancellationToken, Task>? delay = null) : ILanguageModel
{
    /// <summary>
    /// How many attempts a completion gets in total - the first, plus <see cref="_backoff"/>'s two retries.
    /// </summary>
    const int MaxAttempts = 3;

    /// <summary>
    /// The backoff before each retry, when the vendor did not itself say how long to wait
    /// (<see cref="LanguageModelResult.RetryAfter"/>) - one entry per retry, so index
    /// <c>attempt - 1</c> is the wait before attempt <c>attempt</c>.
    /// </summary>
    static readonly TimeSpan[] _backoff = [TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(4)];

    readonly Func<TimeSpan, CancellationToken, Task> _delay = delay ?? Task.Delay;

    /// <inheritdoc/>
    public async Task<LanguageModelResult> Complete(string prompt, LanguageModelPurpose purpose, CancellationToken cancellationToken = default)
    {
        var result = await CompleteWithRetries(prompt, purpose, cancellationToken);

        if (result.Usage is { } usage)
        {
            try
            {
                // Every provider client answers with the model it actually called, so there is
                // nothing left to fall back to for the usage record - a completion that produced
                // usage necessarily went through one of them. NotSet records the usage rather than
                // dropping it in the impossible case, since the tokens were spent either way.
                var model = result.Model ?? ModelName.NotSet;
                var agent = agents.FindByPurpose(purpose);

                using var scope = agentExecution.As(purpose);
                var command = new RecordAgentSessionUsage(
                    AgentSessionId.New(),
                    agent?.Id ?? AgentId.NotSet,
                    model,
                    purpose,
                    result.ProviderId,
                    InputTokens: usage.InputTokens,
                    OutputTokens: usage.OutputTokens,
                    CachedTokens: usage.CachedTokens,
                    CostUsd: usage.CostUsd,
                    Duration: usage.Duration);
                await commandPipeline.ExecuteAndReport(command, logger);
            }
            catch (Exception ex)
            {
                // Losing a usage record is not worth failing the caller's actual completion over.
                logger.FailedToRecordUsage(ex, purpose);
            }
        }

        return result;
    }

    /// <summary>
    /// Retries a completion that failed transiently (a vendor rate limit, server error, or
    /// network-level failure reaching it) up to <see cref="MaxAttempts"/> times in total. A
    /// non-transient failure (misconfiguration, a rejected request) is never retried - another
    /// attempt can never change its outcome. Bounded so the retries' own overhead - the two backoffs
    /// plus the extra attempts, never the underlying call's own timeout - stays well inside the ~30s
    /// a Chronicle reactor's subscriber has before it is considered stuck.
    /// </summary>
    /// <param name="prompt">The prompt.</param>
    /// <param name="purpose">What the completion is for.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/> the last attempt settled on.</returns>
    async Task<LanguageModelResult> CompleteWithRetries(string prompt, LanguageModelPurpose purpose, CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            var result = await inner.Complete(prompt, purpose, cancellationToken);
            if (result.Succeeded || !result.IsTransient || attempt == MaxAttempts)
            {
                return result;
            }

            var wait = result.RetryAfter ?? _backoff[attempt - 1];
            logger.RetryingTransientFailure(purpose, attempt, wait);
            await _delay(wait, cancellationToken);
        }
    }
}

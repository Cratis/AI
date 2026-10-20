// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.Decisions.Usage;

/// <summary>
/// Records what a call to a decision engine consumed.
/// </summary>
public interface IDecisionUsageRecorder
{
    /// <summary>
    /// Records the usage of one call.
    /// </summary>
    /// <param name="requests">The requests the call answered.</param>
    /// <param name="connection">The engine that answered.</param>
    /// <param name="answers">What the engine answered.</param>
    /// <param name="duration">How long the call took.</param>
    /// <returns>Awaitable task.</returns>
    Task Record(IReadOnlyList<DecisionRequest> requests, DecisionEngineConnection connection, DecisionEngineAnswers answers, TimeSpan duration);
}

/// <summary>
/// Reports decision usage as telemetry without appending events.
/// </summary>
/// <param name="telemetry">The decision metrics.</param>
/// <param name="logger">The logger.</param>
public class DecisionUsageRecorder(IDecisionTelemetry telemetry, ILogger<DecisionUsageRecorder> logger) : IDecisionUsageRecorder
{
    /// <inheritdoc/>
    public Task Record(IReadOnlyList<DecisionRequest> requests, DecisionEngineConnection connection, DecisionEngineAnswers answers, TimeSpan duration)
    {
        try
        {
            // A batch is recorded under the topic its first request names. Callers batch one kind of
            // question at a time - every label of one issue, every candidate for one task - so a
            // batch that mixes topics is not a shape anything produces today.
            var topic = requests.Select(_ => _.Topic).FirstOrDefault(_ => _ is not null && !string.IsNullOrWhiteSpace(_.Value)) ?? DecisionTopic.NotSet;

            telemetry.RecordUsage(connection.Type, answers.Model, topic, requests.Count, requests.Sum(_ => _.Choices.Count), answers.InputTokens, answers.OutputTokens);
        }
        catch (Exception ex)
        {
            // Losing a usage record is not worth failing a decision that was already made.
            logger.FailedToRecordUsage(ex, connection.Type);
        }

        return Task.CompletedTask;
    }
}

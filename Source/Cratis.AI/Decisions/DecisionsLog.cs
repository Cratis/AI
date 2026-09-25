// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.Decisions;

/// <summary>
/// Log messages for decisions.
/// </summary>
internal static partial class DecisionsLog
{
    [LoggerMessage(LogLevel.Debug, "Weighing {ChoiceCount} choices on the {Engine} decision engine ({Model})")]
    internal static partial void Deciding(this ILogger logger, int choiceCount, DecisionEngineType engine, string model);

    [LoggerMessage(LogLevel.Warning, "The {Engine} decision engine returned {StatusCode}")]
    internal static partial void UnexpectedStatusCode(this ILogger logger, DecisionEngineType engine, int statusCode);

    [LoggerMessage(LogLevel.Warning, "The {Engine} decision engine returned a response that could not be read")]
    internal static partial void UnreadableResponse(this ILogger logger, Exception exception, DecisionEngineType engine);

    [LoggerMessage(LogLevel.Warning, "The {Engine} decision engine could not be reached")]
    internal static partial void NetworkFailure(this ILogger logger, Exception exception, DecisionEngineType engine);

    [LoggerMessage(LogLevel.Warning, "The {Engine} decision engine did not respond within {Timeout}")]
    internal static partial void RequestTimedOut(this ILogger logger, DecisionEngineType engine, TimeSpan timeout);

    [LoggerMessage(LogLevel.Warning, "The {Engine} decision engine returned {Returned} distributions for {Expected} requests")]
    internal static partial void DistributionCountMismatch(this ILogger logger, DecisionEngineType engine, int returned, int expected);

    [LoggerMessage(LogLevel.Warning, "The {Engine} decision engine returned {Returned} probabilities for {Expected} choices")]
    internal static partial void ChoiceCountMismatch(this ILogger logger, DecisionEngineType engine, int returned, int expected);

    [LoggerMessage(LogLevel.Warning, "No decision engine is available - the caller will have to fall back")]
    internal static partial void NoEngineAvailable(this ILogger logger);

    [LoggerMessage(LogLevel.Warning, "Recording the usage of a decision on the {Engine} decision engine failed")]
    internal static partial void FailedToRecordUsage(this ILogger logger, Exception exception, DecisionEngineType engine);
}

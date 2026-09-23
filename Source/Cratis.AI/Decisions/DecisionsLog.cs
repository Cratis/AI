// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Decisions;

/// <summary>
/// Log messages for the decision path. A decision failure reaches the caller as an exception it
/// will usually swallow into a fallback - which is correct behavior and also means the only record
/// that the decision layer is silently broken is here.
/// </summary>
internal static partial class DecisionsLog
{
    [LoggerMessage(LogLevel.Debug, "Weighing {ChoiceCount} choices on {Vendor}/{Model}")]
    internal static partial void Deciding(this ILogger logger, int choiceCount, AIProviderType vendor, string model);

    [LoggerMessage(LogLevel.Warning, "{Vendor} decision API returned {StatusCode}")]
    internal static partial void UnexpectedStatusCode(this ILogger logger, AIProviderType vendor, int statusCode);

    [LoggerMessage(LogLevel.Warning, "{Vendor} decision API returned a response that could not be read")]
    internal static partial void UnreadableResponse(this ILogger logger, Exception exception, AIProviderType vendor);

    [LoggerMessage(LogLevel.Warning, "{Vendor} decision API could not be reached")]
    internal static partial void NetworkFailure(this ILogger logger, Exception exception, AIProviderType vendor);

    [LoggerMessage(LogLevel.Warning, "{Vendor} decision API did not respond within {Timeout}")]
    internal static partial void RequestTimedOut(this ILogger logger, AIProviderType vendor, TimeSpan timeout);

    [LoggerMessage(LogLevel.Warning, "{Vendor} decision API returned {Returned} probabilities for {Expected} choices")]
    internal static partial void ChoiceCountMismatch(this ILogger logger, AIProviderType vendor, int returned, int expected);

    [LoggerMessage(LogLevel.Error, "No decision provider is configured - the caller will have to fall back")]
    internal static partial void NoProviderConfigured(this ILogger logger);
}

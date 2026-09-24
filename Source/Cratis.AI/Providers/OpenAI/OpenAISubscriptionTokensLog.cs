// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;
namespace Cratis.AI.Providers.OpenAI;

/// <summary>
/// Log messages for the ChatGPT subscription credential exchange. A refresh that fails is the one
/// step between a working subscription and a dead one, and it fails where nobody is watching - in a
/// scheduling pass - so every way it can go wrong says so here.
/// </summary>
internal static partial class OpenAISubscriptionTokensLog
{
    [LoggerMessage(LogLevel.Warning, "OpenAI rejected the ChatGPT subscription refresh with {StatusCode} - the stored credential is probably retired, and the provider needs a newly minted one")]
    internal static partial void SubscriptionRefreshRejected(this ILogger logger, int statusCode);

    [LoggerMessage(LogLevel.Warning, "OpenAI's subscription refresh response was missing fields - keeping the stored credential rather than recording a partial one")]
    internal static partial void SubscriptionRefreshIncomplete(this ILogger logger);

    [LoggerMessage(LogLevel.Warning, "Could not reach OpenAI to refresh the ChatGPT subscription credential")]
    internal static partial void SubscriptionRefreshFailed(this ILogger logger, Exception exception);

    [LoggerMessage(LogLevel.Warning, "OpenAI refused a device sign-in request with {StatusCode}")]
    internal static partial void DeviceSignInRequestRejected(this ILogger logger, int statusCode);

    [LoggerMessage(LogLevel.Warning, "OpenAI's device sign-in response was missing fields")]
    internal static partial void DeviceSignInResponseIncomplete(this ILogger logger);
}

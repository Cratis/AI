// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers;

/// <summary>
/// Log messages shared by every <see cref="IAIProviderClient"/> - the vendor call itself is the one
/// step in a completion's path that is not otherwise diagnosable: a failure here comes back as a
/// <see cref="LanguageModels.LanguageModelResult"/> the caller can act on, but without a log entry
/// there is no way to tell an expired API key, a rate limit, and a vendor outage apart after the
/// fact. Ported from Direct's <c>AIProviders.AIProviderClientLog</c> (plan Section 5.2 step 3).
/// </summary>
internal static partial class AIProviderClientLog
{
    [LoggerMessage(LogLevel.Warning, "{Vendor} language model API returned {StatusCode}")]
    internal static partial void UnexpectedStatusCode(this ILogger logger, AIProviderType vendor, int statusCode);

    [LoggerMessage(LogLevel.Warning, "{Vendor} language model API returned no text")]
    internal static partial void NoTextReturned(this ILogger logger, AIProviderType vendor);

    [LoggerMessage(LogLevel.Warning, "{Vendor} provider is configured with a subscription credential, which only a worker session can spend - chat completions need an API key")]
    internal static partial void SubscriptionCredentialCannotServeChat(this ILogger logger, AIProviderType vendor);

    [LoggerMessage(LogLevel.Warning, "{Vendor} language model API could not be reached")]
    internal static partial void NetworkFailure(this ILogger logger, Exception exception, AIProviderType vendor);

    [LoggerMessage(LogLevel.Warning, "{Vendor} language model API did not respond in time")]
    internal static partial void RequestTimedOut(this ILogger logger, AIProviderType vendor);
}

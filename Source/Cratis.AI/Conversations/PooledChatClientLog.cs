// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Cratis.AI.Providers;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Conversations;

/// <summary>
/// Log messages for <see cref="PooledChatClient"/>.
/// </summary>
internal static partial class PooledChatClientLog
{
    [LoggerMessage(LogLevel.Warning, "The {Purpose} agent names AI provider {ProviderId} but no configured provider goes by that id")]
    internal static partial void ChatProviderNotConfigured(this ILogger logger, AIProviderId providerId, LanguageModelPurpose purpose);

    [LoggerMessage(LogLevel.Warning, "AI provider {ProviderId} (vendor {ProviderType}) does not satisfy the capabilities required by the {Purpose} agent")]
    internal static partial void ChatProviderDoesNotSatisfyAgent(this ILogger logger, AIProviderId providerId, AIProviderType providerType, LanguageModelPurpose purpose);

    [LoggerMessage(LogLevel.Warning, "AI provider {ProviderId} (vendor {ProviderType}) cannot open a chat client for the {Purpose} agent - no model, missing credentials or endpoint, or no conversational client for the vendor")]
    internal static partial void ChatProviderCannotServe(this ILogger logger, AIProviderId providerId, AIProviderType providerType, LanguageModelPurpose purpose);

    [LoggerMessage(LogLevel.Information, "AI provider {ProviderId} is rate limited until {Until} and is skipped")]
    internal static partial void ChatProviderRateLimited(this ILogger logger, AIProviderId providerId, DateTimeOffset until);

    [LoggerMessage(LogLevel.Warning, "AI provider {ProviderId} is saturated - waiting for a concurrency slot timed out")]
    internal static partial void ChatProviderConcurrencyLimitTimedOut(this ILogger logger, AIProviderId providerId);

    [LoggerMessage(LogLevel.Warning, "A chat call to AI provider {ProviderId} for the {Purpose} agent failed")]
    internal static partial void ChatCallFailed(this ILogger logger, Exception exception, AIProviderId providerId, LanguageModelPurpose purpose);

    [LoggerMessage(LogLevel.Warning, "Could not read the capacity of the pool serving the {Purpose} agent - treating every member as available")]
    internal static partial void CouldNotReadChatPoolCapacity(this ILogger logger, Exception exception, LanguageModelPurpose purpose);

    [LoggerMessage(LogLevel.Warning, "Could not record the usage of a chat for the {Purpose} agent")]
    internal static partial void CouldNotRecordChatUsage(this ILogger logger, Exception exception, LanguageModelPurpose purpose);
}

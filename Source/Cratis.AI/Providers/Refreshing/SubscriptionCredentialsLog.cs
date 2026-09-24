// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;
namespace Cratis.AI.Providers.Refreshing;

/// <summary>
/// Log messages for keeping a rotating subscription credential current. A credential that quietly
/// stops working is the failure this whole path exists to avoid, so each step says what it did.
/// </summary>
internal static partial class SubscriptionCredentialsLog
{
    [LoggerMessage(LogLevel.Warning, "Provider {Provider} holds a subscription credential that cannot be read - it needs a newly minted one from Settings")]
    internal static partial void SubscriptionCredentialUnusable(this ILogger logger, AIProviderId provider);

    [LoggerMessage(LogLevel.Information, "Refreshing the subscription credential for provider {Provider}, which expires {ExpiresAt}")]
    internal static partial void RefreshingSubscriptionCredential(this ILogger logger, AIProviderId provider, DateTimeOffset expiresAt);

    [LoggerMessage(LogLevel.Information, "Refreshed the subscription credential for provider {Provider}, now good until {ExpiresAt}")]
    internal static partial void RefreshedSubscriptionCredential(this ILogger logger, AIProviderId provider, DateTimeOffset expiresAt);
}

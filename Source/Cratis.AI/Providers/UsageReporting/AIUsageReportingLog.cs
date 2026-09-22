// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// Log messages for <see cref="AIUsageReporting"/>.
/// </summary>
internal static partial class AIUsageReportingLog
{
    [LoggerMessage(LogLevel.Warning, "No configured AI provider goes by {ProviderId} - answering with no usage report")]
    internal static partial void UnknownConfiguredProvider(this ILogger logger, AIProviderId providerId);

    [LoggerMessage(LogLevel.Warning, "Could not read the usage report for provider {ProviderId} of type {ProviderType} - answering as unreachable")]
    internal static partial void CouldNotReadUsageReport(this ILogger logger, Exception exception, AIProviderId providerId, AIProviderType providerType);

    [LoggerMessage(LogLevel.Warning, "The usage report for provider {ProviderId} did not answer within {Timeout} - answering as unreachable for this refresh")]
    internal static partial void UsageReportTimedOut(this ILogger logger, AIProviderId providerId, TimeSpan timeout);
}

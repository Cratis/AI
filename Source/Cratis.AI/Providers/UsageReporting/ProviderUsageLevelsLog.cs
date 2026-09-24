// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;
namespace Cratis.AI.Providers.UsageReporting;

/// <summary>
/// Log messages for <see cref="ProviderUsageLevels"/>.
/// </summary>
internal static partial class ProviderUsageLevelsLog
{
    [LoggerMessage(LogLevel.Warning, "Could not record the usage snapshot for provider {ProviderId} - the level was still used for selection, just not recorded for audit")]
    internal static partial void CouldNotRecordUsageSnapshot(this ILogger logger, Exception exception, AIProviderId providerId);
}

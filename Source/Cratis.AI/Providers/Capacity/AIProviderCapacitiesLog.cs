// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Log messages for <see cref="AIProviderCapacities"/>.
/// </summary>
internal static partial class AIProviderCapacitiesLog
{
    [LoggerMessage(LogLevel.Debug, "Capacity was asked for provider {ProviderId}, which is not configured")]
    internal static partial void CapacityOfUnknownProvider(this ILogger logger, AIProviderId providerId);

    [LoggerMessage(LogLevel.Information, "The capacity of provider {ProviderId} ({Type}) could not be read: {Problem}")]
    internal static partial void CapacityNotRead(this ILogger logger, AIProviderId providerId, AIProviderType type, string problem);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.Extensions.Logging;

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// Log messages for <see cref="AIProviderCapacitySnapshots"/>.
/// </summary>
internal static partial class AIProviderCapacitySnapshotsLogging
{
    [LoggerMessage(LogLevel.Warning, "Allowance cache capture failed for provider {Provider}; recording an unavailable observation")]
    internal static partial void CaptureFailed(ILogger<AIProviderCapacitySnapshots> logger, AIProviderId provider);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Microsoft.Extensions.Logging;

namespace Cratis.AI.Usage.Recording;

/// <summary>
/// Log messages for <see cref="RecordAgentSessionUsageWithCapacity"/>.
/// </summary>
internal static partial class RecordAgentSessionUsageWithCapacityLogging
{
    [LoggerMessage(LogLevel.Warning, "Allowance capture failed for provider {Provider}; recording an unavailable observation")]
    internal static partial void CaptureFailed(ILogger<RecordAgentSessionUsageWithCapacity> logger, AIProviderId provider);
}

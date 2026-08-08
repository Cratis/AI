// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Hosting;

/// <summary>
/// Log messages for the Planner's hosting concerns.
/// </summary>
internal static partial class HostingLog
{
    [LoggerMessage(LogLevel.Information, "Planner grains activated")]
    internal static partial void GrainsActivated(this ILogger logger);

    [LoggerMessage(LogLevel.Error, "Could not activate Planner grains")]
    internal static partial void CouldNotActivateGrains(this ILogger logger, Exception exception);
}

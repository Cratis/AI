// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.WeeklyDigests.Publishing;

/// <summary>
/// Log messages for the weekly digest publisher.
/// </summary>
internal static partial class WeeklyDigestPublisherLog
{
    [LoggerMessage(LogLevel.Warning, "Publishing the weekly digest to {Outlet} returned {StatusCode}")]
    internal static partial void UnexpectedStatusCode(this ILogger logger, string outlet, int statusCode);

    [LoggerMessage(LogLevel.Warning, "Publishing the weekly digest to {Outlet} failed")]
    internal static partial void PublishFailed(this ILogger logger, Exception exception, string outlet);
}

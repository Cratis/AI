// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Builds.CheckingStatus;

/// <summary>
/// Log messages for the build status checker.
/// </summary>
internal static partial class BuildStatusCheckerLog
{
    [LoggerMessage(LogLevel.Warning, "Could not check the build status of {Owner}/{Repository}")]
    internal static partial void CouldNotCheckBuildStatus(this ILogger logger, Exception exception, OrganizationName owner, RepositoryName repository);
}

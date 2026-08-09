// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.GitHub.Synchronization;

/// <summary>
/// Log messages for GitHub synchronization.
/// </summary>
internal static partial class SynchronizationLog
{
    [LoggerMessage(LogLevel.Information, "Synchronizing issues for {Owner}/{Repository}")]
    internal static partial void SynchronizingRepository(this ILogger logger, OrganizationName owner, RepositoryName repository);

    [LoggerMessage(LogLevel.Error, "GitHub consolidation failed")]
    internal static partial void ConsolidationFailed(this ILogger logger, Exception exception);

    [LoggerMessage(LogLevel.Error, "Could not load the issues of {Owner}/{Repository} when it was added")]
    internal static partial void InitialSynchronizationFailed(this ILogger logger, OrganizationName owner, RepositoryName repository, Exception exception);
}

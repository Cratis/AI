// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Accounts;

namespace Planner.Work.Scheduling;

/// <summary>
/// Log messages for the work dispatcher and scheduler.
/// </summary>
internal static partial class WorkDispatcherLog
{
    [LoggerMessage(LogLevel.Information, "No account with available capacity - {Pending} unit(s) of work stay scheduled")]
    internal static partial void NoCapacity(this ILogger logger, int pending);

    [LoggerMessage(LogLevel.Warning, "Account '{Account}' has no credentials - skipping dispatch")]
    internal static partial void AccountWithoutCredentials(this ILogger logger, AccountName account);

    [LoggerMessage(LogLevel.Warning, "Work {Work} covers no known issues - skipping dispatch")]
    internal static partial void WorkWithoutIssues(this ILogger logger, WorkId work);

    [LoggerMessage(LogLevel.Error, "Could not launch worker for work {Work}")]
    internal static partial void CouldNotLaunchWorker(this ILogger logger, Exception exception, WorkId work);

    [LoggerMessage(LogLevel.Error, "Scheduling pass failed")]
    internal static partial void SchedulingPassFailed(this ILogger logger, Exception exception);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Workers;

/// <summary>Shared launch boundary for concrete runtimes, including direct callers.</summary>
internal static class WorkerProviderAccess
{
    internal static async Task<bool> IsAllowed(WorkerJob job, IProviderMemberAccess? access) =>
        job.Provider is null || (access is not null && await access.IsAllowed(job.Provider));
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories;

/// <summary>
/// How far the Planner got mirroring the issues of a repository from GitHub.
/// </summary>
public enum IssueSynchronizationStatus
{
    /// <summary>The repository has been added and its issues have not been loaded yet.</summary>
    Pending = 0,

    /// <summary>The issues were loaded from GitHub.</summary>
    Synchronized = 1,

    /// <summary>The issues could not be loaded - the reason says why.</summary>
    Failed = 2
}

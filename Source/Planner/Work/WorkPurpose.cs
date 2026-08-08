// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Work;

/// <summary>
/// What a unit of agent work is for.
/// </summary>
public enum WorkPurpose
{
    /// <summary>Investigate the issue(s) and produce an implementation plan.</summary>
    Investigation = 0,

    /// <summary>Implement the issue(s) and open a pull request.</summary>
    Implementation = 1,

    /// <summary>Ad-hoc work over one or more repositories, driven by a free-form prompt.</summary>
    AdHoc = 2
}

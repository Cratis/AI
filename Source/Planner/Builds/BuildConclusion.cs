// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Builds;

/// <summary>
/// How a GitHub Actions workflow run concluded, as GitHub reports it.
/// </summary>
public enum BuildConclusion
{
    /// <summary>The run has not concluded yet, or GitHub reported something the Planner does not recognize.</summary>
    Unknown = 0,

    /// <summary>The run succeeded.</summary>
    Success = 1,

    /// <summary>The run failed.</summary>
    Failure = 2,

    /// <summary>The run was cancelled before it concluded.</summary>
    Cancelled = 3,
}

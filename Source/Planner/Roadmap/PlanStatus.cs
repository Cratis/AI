// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Roadmap;

/// <summary>
/// Where a plan stands.
/// </summary>
public enum PlanStatus
{
    /// <summary>Requested, waiting for the language model to generate it.</summary>
    Generating = 0,

    /// <summary>Generated and ready to read.</summary>
    Ready = 1,

    /// <summary>Generating it failed - most commonly, no language model is configured.</summary>
    Failed = 2,
}

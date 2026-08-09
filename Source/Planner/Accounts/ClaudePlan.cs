// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Accounts;

/// <summary>
/// The Claude subscription plan of an account - determines the usage boundaries the scheduler
/// respects (sessions per five-hour window and per week, per model).
/// </summary>
public enum ClaudePlan
{
    /// <summary>The Pro plan.</summary>
    Pro = 0,

    /// <summary>The Max plan at 5x Pro usage.</summary>
    Max5x = 1,

    /// <summary>The Max plan at 20x Pro usage.</summary>
    Max20x = 2
}

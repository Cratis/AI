// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// One window a provider meters its allowance over, and how much of it is spent.
/// </summary>
/// <param name="Kind">How long the window runs.</param>
/// <param name="Name">A human label for the window, such as "5-hour", "Weekly", "Weekly (Opus)" or "Monthly premium requests".</param>
/// <param name="UsedFraction">How much of the window's allowance is spent, from 0 (nothing) to 1 (all of it).</param>
/// <param name="ResetsAt">When the window's allowance resets, when the vendor says.</param>
public record UsageWindow(UsageWindowKind Kind, string Name, double UsedFraction, DateTimeOffset? ResetsAt)
{
    /// <summary>
    /// Gets how much of the window's allowance is left, from 0 to 1 - clamped, since a vendor
    /// reporting more than 100% used has nothing left rather than a debt.
    /// </summary>
    public double Remaining => Math.Clamp(1 - UsedFraction, 0, 1);
}

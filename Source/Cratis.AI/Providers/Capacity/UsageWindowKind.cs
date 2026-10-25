// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Capacity;

/// <summary>
/// How long one of a provider's usage windows runs before its allowance resets.
/// </summary>
public enum UsageWindowKind
{
    /// <summary>
    /// A rolling five-hour window - the session allowance Claude, Codex and the Z.AI coding plan meter.
    /// </summary>
    FiveHour = 0,

    /// <summary>
    /// A daily window.
    /// </summary>
    Daily = 1,

    /// <summary>
    /// A weekly window - the allowance Claude, Codex and the Z.AI coding plan cap a week's work at.
    /// </summary>
    Weekly = 2,

    /// <summary>
    /// A monthly window - Copilot's premium request allowance.
    /// </summary>
    Monthly = 3,

    /// <summary>
    /// Any other window, including a configured token ceiling that does not reset on its own.
    /// </summary>
    Other = 4,
}

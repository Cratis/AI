// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// How serious the sending system considers an alert to be.
/// </summary>
public enum AlertSeverity
{
    /// <summary>Worth knowing about, but nothing is broken.</summary>
    Information = 0,

    /// <summary>Something is degraded or heading the wrong way.</summary>
    Warning = 1,

    /// <summary>Something is broken and needs attention now.</summary>
    Critical = 2
}

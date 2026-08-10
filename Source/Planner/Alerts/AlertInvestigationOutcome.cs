// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// What an agent concluded after investigating an alert.
/// </summary>
public enum AlertInvestigationOutcome
{
    /// <summary>The agent could not resolve it - a person has to take over.</summary>
    NeedsAttention = 0,

    /// <summary>The agent resolved it.</summary>
    Resolved = 1
}

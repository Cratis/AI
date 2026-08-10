// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Alerts;

/// <summary>
/// Where an alert stands in its lifecycle.
/// </summary>
public enum AlertStatus
{
    /// <summary>
    /// No alert - the state of a read model that was never built or has been deleted. It never
    /// describes a live alert, and is what tells a repeat delivery it is starting a new one.
    /// </summary>
    None = 0,

    /// <summary>Received and waiting for an agent to pick it up.</summary>
    Received = 1,

    /// <summary>An agent is investigating it right now.</summary>
    Investigating = 2,

    /// <summary>An agent looked at it and could not resolve it - a person has to.</summary>
    NeedsAttention = 3,

    /// <summary>The investigation itself failed, so nothing is known about the alert yet.</summary>
    InvestigationFailed = 4,

    /// <summary>Resolved - by the agent that investigated it, or by a person.</summary>
    Resolved = 5
}

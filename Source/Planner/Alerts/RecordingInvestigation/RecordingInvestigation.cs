// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Work;

namespace Planner.Alerts.RecordingInvestigation;

/// <summary>
/// Command for recording that an agent has picked an alert up - executed when the unit of work
/// investigating it starts running.
/// </summary>
/// <param name="Alert">The identity of the alert.</param>
/// <param name="Work">The unit of work investigating it, so the alert can link to its console.</param>
[Command]
public record StartAlertInvestigation(AlertId Alert, WorkId Work)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AlertInvestigationStarted"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AlertInvestigationStarted Handle() => new(Work);
}

/// <summary>
/// Command for recording what an agent concluded about an alert.
/// </summary>
/// <param name="Alert">The identity of the alert.</param>
/// <param name="Outcome">Whether the agent resolved it or needs a person to take over.</param>
/// <param name="Findings">What the agent found, and what it did about it.</param>
[Command]
public record ConcludeAlertInvestigation(AlertId Alert, AlertInvestigationOutcome Outcome, AlertNote Findings)
{
    /// <summary>
    /// Handles the command by appending the event matching what the agent concluded. The two
    /// outcomes are separate facts because they mean different things to whoever reads the log
    /// later - one closed the alert, the other handed it to a person.
    /// </summary>
    /// <returns>The event.</returns>
    public IEnumerable<object> Handle() =>
        Outcome == AlertInvestigationOutcome.Resolved
            ? [new AlertResolvedByAgent(Findings)]
            : [new AlertEscalated(Findings)];
}

/// <summary>
/// Command for recording that the investigation of an alert never produced a conclusion - the
/// agent's session failed or was stopped.
/// </summary>
/// <param name="Alert">The identity of the alert.</param>
/// <param name="Reason">Why the investigation did not conclude.</param>
[Command]
public record FailAlertInvestigation(AlertId Alert, AlertNote Reason)
{
    /// <summary>
    /// Handles the command by appending an <see cref="AlertInvestigationFailed"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AlertInvestigationFailed Handle() => new(Reason);
}

/// <summary>
/// Event raised when an agent started investigating an alert.
/// </summary>
/// <param name="Work">The unit of work doing the investigating.</param>
[EventType]
public record AlertInvestigationStarted(WorkId Work);

/// <summary>
/// Event raised when an agent investigated an alert and resolved it - the condition was something it
/// could act on, and it did.
/// </summary>
/// <param name="Findings">What the agent found, and what it did about it.</param>
[EventType]
public record AlertResolvedByAgent(AlertNote Findings);

/// <summary>
/// Event raised when an agent investigated an alert and concluded it cannot resolve it. The alert
/// waits for a person from here on; the findings are what that person starts from.
/// </summary>
/// <param name="Findings">What the agent found, and why it could not act on it.</param>
[EventType]
public record AlertEscalated(AlertNote Findings);

/// <summary>
/// Event raised when the investigation of an alert never produced a conclusion.
/// </summary>
/// <param name="Reason">Why the investigation did not conclude.</param>
[EventType]
public record AlertInvestigationFailed(AlertNote Reason);

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Alerts.Listing;

namespace Planner.Alerts.Raising;

/// <summary>
/// Command for reporting that something is wrong in a running system - executed for every delivery
/// the alert webhook accepts. A production watchdog re-reports a condition it cannot fix for as long
/// as it lasts, so the same fingerprint arriving again is recorded as another sighting of the alert
/// already open rather than as a new one.
/// </summary>
/// <param name="Source">The system the alert came from.</param>
/// <param name="Title">The one-line headline.</param>
/// <param name="Summary">What the sending system had to say about it.</param>
/// <param name="Severity">How serious the sending system considers it.</param>
/// <param name="Fingerprint">The sending system's stable key for the condition.</param>
[Command]
public record RaiseAlert(
    AlertSource Source,
    AlertTitle Title,
    AlertSummary Summary,
    AlertSeverity Severity,
    AlertFingerprint Fingerprint) : ICanProvideEventSourceId
{
    /// <inheritdoc/>
    public EventSourceId GetEventSourceId() => AlertId.From(Source, Fingerprint);

    /// <summary>
    /// Handles the command by raising a new alert, or - when one is already open on this
    /// fingerprint - recording that the condition was seen again.
    /// </summary>
    /// <param name="alert">The alert already on this fingerprint, resolved by the command's event source id.</param>
    /// <returns>The event.</returns>
    /// <remarks>
    /// A deleted alert leaves a default-initialized read model behind rather than nothing, which is
    /// why <see cref="AlertStatus.None"/> - a status no live alert ever holds - is what separates
    /// "nothing open here" from "open, seen again". A resolved alert firing again genuinely is new:
    /// whatever fixed it stopped holding.
    /// </remarks>
    public IEnumerable<object> Handle(Alert? alert) =>
        IsOpen(alert)
            ? [new AlertObserved(Summary, Severity)]
            : [new AlertRaised(Source, Title, Summary, Severity, Fingerprint)];

    static bool IsOpen(Alert? alert) =>
        alert?.Status is { } status && status is not (AlertStatus.None or AlertStatus.Resolved);
}

/// <summary>
/// Represents the validator for the <see cref="RaiseAlert"/> command.
/// </summary>
public class RaiseAlertValidator : CommandValidator<RaiseAlert>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RaiseAlertValidator"/> class.
    /// </summary>
    public RaiseAlertValidator()
    {
        RuleFor(_ => _.Source).NotEqual(AlertSource.NotSet).WithMessage("An alert must say which system it came from");
        RuleFor(_ => _.Title).NotEqual(AlertTitle.NotSet).WithMessage("An alert must have a title");
        RuleFor(_ => _.Fingerprint).NotEqual(AlertFingerprint.NotSet).WithMessage("An alert must carry a fingerprint identifying the condition");
    }
}

/// <summary>
/// Event raised the first time a condition is reported - and again when a condition that had been
/// resolved comes back, because whatever fixed it stopped holding.
/// </summary>
/// <param name="Source">The system the alert came from.</param>
/// <param name="Title">The one-line headline.</param>
/// <param name="Summary">What the sending system had to say about it.</param>
/// <param name="Severity">How serious the sending system considers it.</param>
/// <param name="Fingerprint">The sending system's stable key for the condition.</param>
[EventType]
public record AlertRaised(
    AlertSource Source,
    AlertTitle Title,
    AlertSummary Summary,
    AlertSeverity Severity,
    AlertFingerprint Fingerprint);

/// <summary>
/// Event raised when an alert that is already open is reported again. The summary and severity
/// travel along because a condition can worsen while it goes unresolved.
/// </summary>
/// <param name="Summary">What the sending system had to say this time.</param>
/// <param name="Severity">How serious the sending system considers it now.</param>
[EventType]
public record AlertObserved(AlertSummary Summary, AlertSeverity Severity);

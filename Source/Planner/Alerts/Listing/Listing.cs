// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using MongoDB.Driver;
using Planner.Alerts.AddingNote;
using Planner.Alerts.ConvertingToIssue;
using Planner.Alerts.Deleting;
using Planner.Alerts.Raising;
using Planner.Alerts.RecordingInvestigation;
using Planner.Alerts.Resolving;
using Planner.Work;

namespace Planner.Alerts.Listing;

/// <summary>
/// A note recorded against an alert.
/// </summary>
/// <param name="Id">The identity of the note.</param>
/// <param name="Text">What was recorded.</param>
/// <param name="AddedBy">The login of the user that recorded it - <see cref="UserName.NotSet"/> for automation.</param>
public record AlertNoteEntry(AlertNoteId Id, AlertNote Text, UserName AddedBy);

/// <summary>
/// Read model for the alert board - everything reported from running systems, where each alert
/// stands, what an agent made of it, and what people have added since.
/// </summary>
/// <param name="Id">The alert identity - derived from the source and fingerprint.</param>
/// <param name="Source">The system the alert came from.</param>
/// <param name="Title">The one-line headline.</param>
/// <param name="Summary">What the sending system had to say, as of the most recent sighting.</param>
/// <param name="Severity">How serious the sending system considers it, as of the most recent sighting.</param>
/// <param name="Fingerprint">The sending system's stable key for the condition.</param>
/// <param name="Status">Where the alert stands.</param>
/// <param name="Occurrences">How many times the condition has been reported.</param>
/// <param name="RaisedAt">When this occurrence of the alert started.</param>
/// <param name="LastObservedAt">When the condition was last reported.</param>
/// <param name="Work">The unit of work investigating it - <see langword="null"/> until an agent picks it up.</param>
/// <param name="Findings">What the agent concluded - <see langword="null"/> until an investigation finishes.</param>
/// <param name="Resolution">How a person resolved it - <see langword="null"/> unless one did.</param>
/// <param name="ResolvedBy">The login of the user that resolved it.</param>
/// <param name="Issue">The issue this alert was turned into - <see langword="null"/> unless it was.</param>
/// <param name="IssueUrl">The html URL of that issue.</param>
/// <param name="IssueOwner">The organization owning the repository the issue was created in.</param>
/// <param name="IssueRepository">The repository the issue was created in.</param>
/// <param name="Notes">The notes recorded against the alert.</param>
[ReadModel]
[FromEvent<AlertRaised>]
[RemovedWith<AlertDeleted>]
public record Alert(
    AlertId Id,
    AlertSource Source,
    AlertTitle Title,
    AlertSummary Summary,
    AlertSeverity Severity,
    AlertFingerprint Fingerprint,
    [SetValue<AlertRaised>(AlertStatus.Received)]
    [SetValue<AlertInvestigationStarted>(AlertStatus.Investigating)]
    [SetValue<AlertEscalated>(AlertStatus.NeedsAttention)]
    [SetValue<AlertInvestigationFailed>(AlertStatus.InvestigationFailed)]
    [SetValue<AlertResolvedByAgent>(AlertStatus.Resolved)]
    [SetValue<AlertResolved>(AlertStatus.Resolved)]
    AlertStatus Status = AlertStatus.None,
    [Increment<AlertRaised>]
    [Increment<AlertObserved>]
    int Occurrences = 0,
    [SetFromContext<AlertRaised>(nameof(EventContext.Occurred))]
    DateTimeOffset? RaisedAt = null,
    [SetFromContext<AlertRaised>(nameof(EventContext.Occurred))]
    [SetFromContext<AlertObserved>(nameof(EventContext.Occurred))]
    DateTimeOffset? LastObservedAt = null,
    WorkId? Work = null,
    [SetFrom<AlertInvestigationFailed>(nameof(AlertInvestigationFailed.Reason))]
    AlertNote? Findings = null,
    AlertNote? Resolution = null,
    UserName? ResolvedBy = null,
    [SetFrom<AlertConvertedToIssue>(nameof(AlertConvertedToIssue.Number))]
    IssueNumber? Issue = null,
    [SetFrom<AlertConvertedToIssue>(nameof(AlertConvertedToIssue.Url))]
    IssueUrl? IssueUrl = null,
    [SetFrom<AlertConvertedToIssue>(nameof(AlertConvertedToIssue.Owner))]
    OrganizationName? IssueOwner = null,
    [SetFrom<AlertConvertedToIssue>(nameof(AlertConvertedToIssue.Repository))]
    RepositoryName? IssueRepository = null,
    [ChildrenFrom<AlertNoteAdded>(key: nameof(AlertNoteAdded.Note), identifiedBy: nameof(AlertNoteEntry.Id))]
    IEnumerable<AlertNoteEntry>? Notes = null)
{
    /// <summary>
    /// Observes every alert on the board.
    /// </summary>
    /// <param name="collection">The MongoDB collection holding the alerts.</param>
    /// <returns>An observable of all alerts.</returns>
    public static ISubject<IEnumerable<Alert>> AllAlerts(IMongoCollection<Alert> collection) =>
        collection.Observe();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.AddingNote;
using Planner.Alerts.Raising;
using Planner.Alerts.Resolving;

namespace Planner.Alerts.Listing.for_Alert.when_projecting;

public class and_a_person_resolves_it : Specification
{
    static readonly AlertId _alertId = AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff");
    static readonly AlertNoteId _firstNote = AlertNoteId.New();
    static readonly AlertNoteId _secondNote = AlertNoteId.New();

    ReadModelScenario<Alert> _scenario;

    void Establish() => _scenario = new();

    async Task Because() =>
        await _scenario.Given
            .ForEventSource(_alertId)
            .Events(
                new AlertRaised(
                    "studio-production",
                    "Loki is crash looping",
                    "loki-0 has restarted 370 times",
                    AlertSeverity.Critical,
                    "pod:studio/loki-0:CrashLoopBackOff"),
                new AlertNoteAdded(_firstNote, "The retention config never applied", "einari"),
                new AlertNoteAdded(_secondNote, "Resized the volume to 40Gi", "einari"),
                new AlertResolved("Resized the volume and re-rolled the statefulset", "einari"));

    [Fact] void should_be_resolved() => _scenario.Instance.Status.ShouldEqual(AlertStatus.Resolved);
    [Fact] void should_hold_the_resolution() => _scenario.Instance.Resolution.ShouldEqual(new AlertNote("Resized the volume and re-rolled the statefulset"));
    [Fact] void should_hold_who_resolved_it() => _scenario.Instance.ResolvedBy.ShouldEqual(new UserName("einari"));
    [Fact] void should_keep_every_note() => _scenario.Instance.Notes.Count().ShouldEqual(2);
}
#endif

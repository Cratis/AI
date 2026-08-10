// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
namespace Planner.Alerts.Investigating.for_AlertOutcomes;

public class when_reading_the_outcome : Specification
{
    AlertInvestigationOutcome _resolved;
    AlertInvestigationOutcome _needsAttention;
    AlertInvestigationOutcome _silent;
    AlertInvestigationOutcome _mentionedInProse;

    void Because()
    {
        _resolved = AlertOutcomes.Read("Deleted the stale lock file.\n\nALERT-OUTCOME: resolved\n\nFindings follow.");
        _needsAttention = AlertOutcomes.Read("ALERT-OUTCOME: needs-attention\n\nThe volume needs resizing.");
        _silent = AlertOutcomes.Read("I had a look and everything seems fine now.");
        _mentionedInProse = AlertOutcomes.Read("I would say the ALERT-OUTCOME: resolved line goes at the end.");
    }

    [Fact] void should_read_a_resolved_marker() => _resolved.ShouldEqual(AlertInvestigationOutcome.Resolved);
    [Fact] void should_read_a_needs_attention_marker() => _needsAttention.ShouldEqual(AlertInvestigationOutcome.NeedsAttention);
    [Fact] void should_hand_a_silent_session_to_a_person() => _silent.ShouldEqual(AlertInvestigationOutcome.NeedsAttention);
    [Fact] void should_ignore_a_marker_that_is_not_on_its_own_line() => _mentionedInProse.ShouldEqual(AlertInvestigationOutcome.NeedsAttention);
}
#endif

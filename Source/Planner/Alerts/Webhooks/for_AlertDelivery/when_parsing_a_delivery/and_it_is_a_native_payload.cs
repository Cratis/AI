// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.Raising;

namespace Planner.Alerts.Webhooks.for_AlertDelivery.when_parsing_a_delivery;

public class and_it_is_a_native_payload : Specification
{
    RaiseAlert _command;

    void Because() => _command = AlertDelivery.Parse(
        """
        {
            "source": "studio-production",
            "title": "Loki is crash looping",
            "summary": "loki-0 has restarted 370 times",
            "severity": "critical",
            "fingerprint": "pod:studio/loki-0:CrashLoopBackOff"
        }
        """,
        "production");

    [Fact] void should_read_the_source() => _command.Source.ShouldEqual(new AlertSource("studio-production"));
    [Fact] void should_read_the_title() => _command.Title.ShouldEqual(new AlertTitle("Loki is crash looping"));
    [Fact] void should_read_the_summary() => _command.Summary.ShouldEqual(new AlertSummary("loki-0 has restarted 370 times"));
    [Fact] void should_read_the_severity() => _command.Severity.ShouldEqual(AlertSeverity.Critical);
    [Fact] void should_read_the_fingerprint() => _command.Fingerprint.ShouldEqual(new AlertFingerprint("pod:studio/loki-0:CrashLoopBackOff"));
}
#endif

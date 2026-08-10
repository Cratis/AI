// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.Raising;

namespace Planner.Alerts.Webhooks.for_AlertDelivery.when_parsing_a_delivery;

/// <summary>
/// The exact shape Cratis Studio's cluster-health watchdog posts to its Discord webhook - the point
/// of accepting it is that pointing that watchdog at the Planner needs no change to the watchdog.
/// </summary>
public class and_it_is_a_discord_payload : Specification
{
    RaiseAlert _command;

    void Because() => _command = AlertDelivery.Parse(
        """
        {
            "embeds": [{
                "title": "[studio] 2 cluster issue(s) need attention",
                "description": "New since the last alert:\n- studio/loki-0 container 'loki': CrashLoopBackOff (restarts: 370)",
                "color": 15158332
            }]
        }
        """,
        "studio-production");

    [Fact] void should_fall_back_to_the_configured_source() => _command.Source.ShouldEqual(new AlertSource("studio-production"));
    [Fact] void should_read_the_title_from_the_embed() => _command.Title.ShouldEqual(new AlertTitle("[studio] 2 cluster issue(s) need attention"));
    [Fact] void should_read_the_summary_from_the_embed_description() => _command.Summary.Value.ShouldContain("CrashLoopBackOff");
    [Fact] void should_read_a_red_embed_as_critical() => _command.Severity.ShouldEqual(AlertSeverity.Critical);
    [Fact] void should_fingerprint_on_the_title() => _command.Fingerprint.ShouldEqual(new AlertFingerprint("[studio] 2 cluster issue(s) need attention"));
}
#endif

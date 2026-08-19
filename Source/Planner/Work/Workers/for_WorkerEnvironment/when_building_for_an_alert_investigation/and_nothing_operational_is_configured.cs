// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts;
using Planner.Work.Listing;
using context = Planner.Work.Workers.for_WorkerEnvironment.given.all_dependencies;

namespace Planner.Work.Workers.for_WorkerEnvironment.when_building_for_an_alert_investigation;

public class and_nothing_operational_is_configured : context
{
    static readonly AlertId _alertId = AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff");

    IReadOnlyDictionary<string, string> _result;

    void Establish() => BuildEnvironmentBuilder();

    async Task Because() => _result = await _environment.Build(
        new WorkItem(_workId, WorkPurpose.AlertInvestigation, [], ModelName.NotSet, UserName.NotSet, Alert: _alertId),
        [],
        _credentials,
        "opus",
        _callbackToken);

    [Fact] void should_still_dispatch_the_work() => _result["PLANNER_PROMPT"].ShouldNotBeEmpty();
    [Fact] void should_tell_the_agent_it_can_reach_nothing() => _result["PLANNER_PROMPT"].ShouldContain("gave you no access");
    [Fact] void should_clone_nothing() => _result.ContainsKey("PLANNER_REPOSITORY_URLS").ShouldBeFalse();
    [Fact] void should_hand_over_no_credentials_it_does_not_have() => _result.ContainsKey("PLANNER_KUBECONFIG").ShouldBeFalse();
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts;
using Planner.Work.Listing;
using context = Planner.Work.Workers.for_WorkerEnvironment.given.all_dependencies;

namespace Planner.Work.Workers.for_WorkerEnvironment.when_building_for_an_alert_investigation;

public class and_operational_access_is_configured : context
{
    static readonly AlertId _alertId = AlertId.From("studio-production", "pod:studio/loki-0:CrashLoopBackOff");

    IReadOnlyDictionary<string, string> _result;

    void Establish()
    {
        _operationsOptions.Kubeconfig = "apiVersion: v1\nkind: Config";
        _operationsOptions.KubernetesNamespace = "studio";
        _operationsOptions.LokiUrl = "http://loki.studio.svc.cluster.local:3100";
        _operationsOptions.Repositories = ["Cratis/Studio"];
        BuildEnvironmentBuilder();
    }

    async Task Because() => _result = await _environment.Build(
        new WorkItem(_workId, WorkPurpose.AlertInvestigation, [], ModelName.NotSet, UserName.NotSet, Alert: _alertId),
        [],
        _credentials,
        "opus",
        _callbackToken);

    [Fact] void should_hand_over_the_kubeconfig() => _result["PLANNER_KUBECONFIG"].ShouldEqual("apiVersion: v1\nkind: Config");
    [Fact] void should_hand_over_the_namespace() => _result["PLANNER_KUBE_NAMESPACE"].ShouldEqual("studio");
    [Fact] void should_hand_over_the_log_endpoint() => _result["PLANNER_LOKI_URL"].ShouldEqual("http://loki.studio.svc.cluster.local:3100");
    [Fact] void should_not_hand_over_access_that_is_not_configured() => _result.ContainsKey("DOCKER_HOST").ShouldBeFalse();
    [Fact] void should_clone_the_configured_repositories() => _result["PLANNER_REPOSITORY_URLS"].ShouldEqual("https://github.com/Cratis/Studio.git");
    [Fact] void should_authenticate_against_github() => _result["GITHUB_TOKEN"].ShouldEqual("installation-token");
    [Fact] void should_tell_the_agent_what_it_can_reach() => _result["PLANNER_PROMPT"].ShouldContain("kubectl");
}
#endif

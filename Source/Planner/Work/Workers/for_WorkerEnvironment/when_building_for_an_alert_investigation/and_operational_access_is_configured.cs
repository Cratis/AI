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

    WorkerEnvironmentResult _result;

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
        _token);

    [Fact] void should_hand_over_the_kubeconfig() => _result.Secrets["PLANNER_KUBECONFIG"].ShouldEqual("apiVersion: v1\nkind: Config");
    [Fact] void should_hand_over_the_namespace() => _result.Variables["PLANNER_KUBE_NAMESPACE"].ShouldEqual("studio");
    [Fact] void should_hand_over_the_log_endpoint() => _result.Variables["PLANNER_LOKI_URL"].ShouldEqual("http://loki.studio.svc.cluster.local:3100");
    [Fact] void should_not_hand_over_access_that_is_not_configured() => _result.Variables.ContainsKey("DOCKER_HOST").ShouldBeFalse();
    [Fact] void should_clone_the_configured_repositories() => _result.Variables["PLANNER_REPOSITORY_URLS"].ShouldEqual("https://github.com/Cratis/Studio.git");
    [Fact] void should_authenticate_against_github() => _result.Secrets["GITHUB_TOKEN"].ShouldEqual("installation-token");
    [Fact] void should_tell_the_agent_what_it_can_reach() => _result.Variables["PLANNER_PROMPT"].ShouldContain("kubectl");

    // The whole point of the split: a credential on the container specification is readable by
    // anyone who can read the specification.
    [Fact] void should_not_put_the_kubeconfig_on_the_specification() => _result.Variables.ContainsKey("PLANNER_KUBECONFIG").ShouldBeFalse();
    [Fact] void should_not_put_the_github_token_on_the_specification() => _result.Variables.ContainsKey("GITHUB_TOKEN").ShouldBeFalse();
}
#endif

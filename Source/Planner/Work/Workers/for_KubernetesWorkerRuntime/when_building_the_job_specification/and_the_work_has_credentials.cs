// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using k8s;
using k8s.Models;

namespace Planner.Work.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

/// <summary>
/// The acceptance criterion from issue #86, asserted against the serialized specification rather
/// than against the object model: "No credential appears in <c>kubectl get job -o yaml</c>".
/// Serializing is what makes this a real check - it sees every field, including any a future edit
/// adds without thinking about it.
/// </summary>
public class and_the_work_has_credentials : Specification
{
    const string _oauthToken = "sk-ant-secret-value";
    const string _callbackToken = "callback-secret-value";
    const string _gitHubToken = "ghs-secret-value";

    V1Job _result;
    string _yaml;

    void Because()
    {
        _result = KubernetesWorkerRuntime.BuildJobSpecification(new WorkerJob(
            WorkId.New(),
            "cratis/planner-worker:latest",
            new Dictionary<string, string> { ["PLANNER_MODEL"] = "opus" },
            new Dictionary<string, string>
            {
                ["CLAUDE_CODE_OAUTH_TOKEN"] = _oauthToken,
                ["PLANNER_CALLBACK_TOKEN"] = _callbackToken,
                ["GITHUB_TOKEN"] = _gitHubToken
            }));
        _yaml = KubernetesYaml.Serialize(_result);
    }

    [Fact] void should_not_expose_the_account_token() => _yaml.ShouldNotContain(_oauthToken);
    [Fact] void should_not_expose_the_callback_token() => _yaml.ShouldNotContain(_callbackToken);
    [Fact] void should_not_expose_the_github_token() => _yaml.ShouldNotContain(_gitHubToken);

    [Fact]
    void should_still_carry_the_non_secret_configuration() =>
        _result.Spec.Template.Spec.Containers[0].Env.ShouldContain(variable => variable.Name == "PLANNER_MODEL" && variable.Value == "opus");

    [Fact]
    void should_mount_the_secrets_read_only() =>
        _result.Spec.Template.Spec.Containers[0].VolumeMounts.ShouldContain(mount =>
            mount.MountPath == WorkerSecrets.Directory && mount.ReadOnlyProperty == true);

    [Fact]
    void should_tell_the_entrypoint_where_to_read_them() =>
        _result.Spec.Template.Spec.Containers[0].Env.ShouldContain(variable =>
            variable.Name == WorkerSecrets.PathVariableName && variable.Value == WorkerSecrets.Path);

    [Fact]
    void should_deliver_them_readable_only_by_the_owner() =>
        _result.Spec.Template.Spec.Volumes[0].Secret.DefaultMode.ShouldEqual(256);
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_building_the_job_specification;

public class and_a_scratch_volume_is_configured : Specification
{
    const string Image = "cratis/ai-agents-claude:latest";

    V1PodSpec _pod;
    V1Volume _volume;
    V1Container _init;

    void Because()
    {
        var job = new WorkerJob(AgentSessionId.New(), Image, new Dictionary<string, string>(), new Dictionary<string, string>());
        _pod = KubernetesWorkerRuntime.BuildJobSpecification(job, scratch: new WorkerScratch("upcloud-scratch", "30Gi")).Spec.Template.Spec;
        _volume = _pod.Volumes.Single(volume => volume.Name == WorkerScratch.VolumeName);
        _init = _pod.InitContainers.Single();
    }

    [Fact] void should_provision_the_volume_from_the_storage_class() => _volume.Ephemeral.VolumeClaimTemplate.Spec.StorageClassName.ShouldEqual("upcloud-scratch");
    [Fact] void should_size_the_volume() => _volume.Ephemeral.VolumeClaimTemplate.Spec.Resources.Requests["storage"].ToString().ShouldEqual("30Gi");
    [Fact] void should_mount_a_directory_on_the_volume_as_the_workspace() =>
        _pod.Containers[0].VolumeMounts.ShouldContain(mount => mount.Name == WorkerScratch.VolumeName && mount.MountPath == WorkerScratch.WorkspacePath && !string.IsNullOrEmpty(mount.SubPath));
    [Fact] void should_prepare_the_workspace_with_the_worker_image() => _init.Image.ShouldEqual(Image);
    [Fact] void should_prepare_the_workspace_without_privilege_escalation() => _init.SecurityContext.AllowPrivilegeEscalation.ShouldEqual(false);
    [Fact] void should_give_the_volume_the_agents_group() => _pod.SecurityContext.FsGroup.ShouldEqual(_pod.SecurityContext.RunAsUser);
    [Fact] void should_still_run_as_non_root() => _pod.SecurityContext.RunAsNonRoot.ShouldEqual(true);
}

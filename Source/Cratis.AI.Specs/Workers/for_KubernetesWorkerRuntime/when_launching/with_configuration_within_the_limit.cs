// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_launching;

public class with_configuration_within_the_limit : given.a_launch
{
    void Establish() => _job = _job with { ConfigurationFiles = new Dictionary<string, string> { ["request.json"] = new('é', 500000) } };
    async Task Because() => _outcome = await Start();
    [Fact] void should_start() => _outcome.ShouldEqual(WorkerLaunchOutcome.Started);
    [Fact] void should_mount_the_configuration() => _createdSecret.StringData["request.json"].ShouldEqual(_job.ConfigurationFiles!["request.json"]);
    [Fact] void should_keep_the_default_deadline() => _createdJob.Spec.ActiveDeadlineSeconds.ShouldEqual(172800);
}

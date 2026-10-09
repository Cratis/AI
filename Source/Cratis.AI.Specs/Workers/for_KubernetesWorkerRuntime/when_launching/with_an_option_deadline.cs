// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_launching;

public class with_an_option_deadline : given.a_launch
{
    void Establish() => _options.WorkerDeadline = TimeSpan.FromMinutes(20);
    async Task Because() => _outcome = await Start();
    [Fact] void should_use_the_option_deadline() => _createdJob.Spec.ActiveDeadlineSeconds.ShouldEqual(1200);
    [Fact] void should_start() => _outcome.ShouldEqual(WorkerLaunchOutcome.Started);
}

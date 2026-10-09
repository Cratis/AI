// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_launching;

public class with_a_non_positive_job_deadline : given.a_launch
{
    void Establish()
    {
        _options.WorkerDeadline = TimeSpan.FromMinutes(20);
        _job = _job with { Deadline = TimeSpan.Zero };
    }
    async Task Because() => _outcome = await Start();
    [Fact] void should_fall_back_to_the_option() => _createdJob.Spec.ActiveDeadlineSeconds.ShouldEqual(1200);
}

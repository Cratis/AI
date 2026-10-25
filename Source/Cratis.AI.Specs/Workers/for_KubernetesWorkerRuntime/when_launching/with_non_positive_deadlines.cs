// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_launching;

public class with_non_positive_deadlines : given.a_launch
{
    void Establish()
    {
        _options.WorkerDeadline = TimeSpan.Zero;
        _job = _job with { Deadline = TimeSpan.FromMinutes(-1) };
    }
    async Task Because() => _outcome = await Start();
    [Fact] void should_fall_back_to_48_hours() => _createdJob.Spec.ActiveDeadlineSeconds.ShouldEqual(172800);
}

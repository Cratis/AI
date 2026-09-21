// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_streaming_logs;

public class and_capture_starts_before_the_container : given.a_console_stream
{
    void Establish()
    {
        _pods.Enqueue(new V1PodList { Items = [] });
        _pods.Enqueue(Pod(new V1ContainerState { Waiting = new V1ContainerStateWaiting { Reason = "ContainerCreating" } }));
        _pods.Enqueue(Pod(new V1ContainerState { Running = new V1ContainerStateRunning() }));
    }

    Task Because() => Read();

    [Fact] void should_wait_through_both_readiness_states() => _listCalls.ShouldEqual(3);
    [Fact] void should_open_the_console_only_once_it_is_readable() => _logCalls.ShouldEqual(1);
    [Fact] void should_keep_the_first_line() => _lines[0].ShouldEqual("first line");
    [Fact] void should_keep_the_final_line() => _lines[1].ShouldEqual("last line");
}

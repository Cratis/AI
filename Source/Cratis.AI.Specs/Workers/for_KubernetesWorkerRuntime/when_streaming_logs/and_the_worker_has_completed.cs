// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using k8s.Models;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_streaming_logs;

public class and_the_worker_has_completed : given.a_console_stream
{
    void Establish() => _pods.Enqueue(Pod(new V1ContainerState { Terminated = new V1ContainerStateTerminated { ExitCode = 0 } }));

    Task Because() => Read();

    [Fact] void should_read_the_completed_containers_console() => _logCalls.ShouldEqual(1);
    [Fact] void should_keep_its_output() => _lines.ShouldContainOnly("first line", "last line");
}

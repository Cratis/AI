// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_streaming_logs;

public class and_capture_is_cancelled : given.a_console_stream
{
    Exception? _exception;

    async Task Because() => _exception = await Catch.Exception(() => Read(new CancellationToken(canceled: true)));

    [Fact] void should_honor_cancellation() => _exception.ShouldBeOfExactType<OperationCanceledException>();
    [Fact] void should_not_query_kubernetes_after_cancellation() => _listCalls.ShouldEqual(0);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using k8s.Autorest;
using k8s.Models;
using NSubstitute.Extensions;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_streaming_logs;

public class and_the_job_has_been_removed : given.a_console_stream
{
    void Establish()
    {
        _pods.Enqueue(new V1PodList { Items = [] });
        _batch.ReturnsForAll(Task.FromException<HttpOperationResponse<V1Job>>(new HttpOperationException("not found")
        {
            Response = new HttpResponseMessageWrapper(new HttpResponseMessage(HttpStatusCode.NotFound), string.Empty)
        }));
    }

    Task Because() => Read();

    [Fact] void should_finish_without_polling_a_deleted_job() => _listCalls.ShouldEqual(1);
    [Fact] void should_not_try_to_open_a_nonexistent_console() => _logCalls.ShouldEqual(0);
    [Fact] void should_not_invent_output() => _lines.ShouldBeEmpty();
}

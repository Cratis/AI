// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text;
using Cratis.AI.Usage;
using k8s;
using k8s.Autorest;
using k8s.Models;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NSubstitute;
using NSubstitute.Extensions;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.given;

public class a_console_stream : Specification
{
    protected ICoreV1Operations _core;
    protected IBatchV1Operations _batch;
    protected KubernetesWorkerRuntime _runtime;
    protected Queue<V1PodList> _pods;
    protected List<string> _lines;
    protected int _listCalls;
    protected int _logCalls;
    protected string _output = "first line\nlast line\n";

    protected static V1PodList Pod(V1ContainerState state) => new()
    {
        Items = [new V1Pod
        {
            Metadata = new V1ObjectMeta { Name = "worker-pod" },
            Status = new V1PodStatus { ContainerStatuses = [new V1ContainerStatus { Name = "worker", State = state }] }
        }]
    };

    protected async Task Read(CancellationToken cancellationToken = default)
    {
        await foreach (var line in _runtime.StreamLogs(AgentSessionId.New(), cancellationToken))
        {
            _lines.Add(line);
        }
    }

    void Establish()
    {
        _pods = new();
        _lines = [];
        _core = Substitute.For<ICoreV1Operations>();
        _batch = Substitute.For<IBatchV1Operations>();
        _core.ReturnsForAll<Task<HttpOperationResponse<V1PodList>>>(_ =>
        {
            _listCalls++;
            return Task.FromResult(new HttpOperationResponse<V1PodList> { Body = _pods.Dequeue() });
        });
        _core.ReturnsForAll<Task<HttpOperationResponse<Stream>>>(_ =>
        {
            _logCalls++;
            return Task.FromResult(new HttpOperationResponse<Stream>
            {
                Body = new MemoryStream(Encoding.UTF8.GetBytes(_output)),
                Request = new HttpRequestMessage()
            });
        });
        _batch.ReturnsForAll(Task.FromResult(new HttpOperationResponse<V1Job> { Body = new V1Job { Status = new V1JobStatus() } }));
        var client = Substitute.For<IKubernetes>();
        client.CoreV1.Returns(_core);
        client.BatchV1.Returns(_batch);
        var factory = Substitute.For<IKubernetesClientFactory>();
        factory.Create().Returns(client);
        _runtime = new(Options.Create(new WorkerRuntimeOptions()), NullLogger<KubernetesWorkerRuntime>.Instance, factory);
    }
}

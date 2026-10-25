// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Net;
using Cratis.AI.Usage;
using k8s;
using k8s.Autorest;
using k8s.Models;
using Microsoft.Extensions.Options;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.given;

public class a_launch : Specification
{
    protected IKubernetesClientFactory _factory;
    protected IBatchV1Operations _batch;
    protected ICoreV1Operations _core;
    protected WorkerRuntimeOptions _options;
    protected WorkerJob _job;
    protected WorkerLaunchOutcome _outcome;
    protected V1Job _createdJob;
    protected V1Secret _createdSecret;

    static Exception NotFound() => new HttpOperationException("not found")
    {
        Response = new HttpResponseMessageWrapper(new HttpResponseMessage(HttpStatusCode.NotFound), string.Empty)
    };

    void Establish()
    {
        _options = new WorkerRuntimeOptions();
        _job = new(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string>());
        _batch = Substitute.For<IBatchV1Operations>();
        _core = Substitute.For<ICoreV1Operations>();
        _batch.ReadNamespacedJobWithHttpMessagesAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>()).Throws(NotFound());
        _batch.DeleteNamespacedJobWithHttpMessagesAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<V1DeleteOptions>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<bool?>(), Arg.Any<bool?>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>()).Throws(NotFound());
        _core.DeleteNamespacedSecretWithHttpMessagesAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<V1DeleteOptions>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<bool?>(), Arg.Any<bool?>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>()).Throws(NotFound());
        _core.CreateNamespacedSecretWithHttpMessagesAsync(Arg.Any<V1Secret>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            _createdSecret = call.Arg<V1Secret>();
            return Task.FromResult(new HttpOperationResponse<V1Secret> { Body = new V1Secret { Metadata = new V1ObjectMeta { Name = "worker", Uid = "secret" } } });
        });
        _batch.CreateNamespacedJobWithHttpMessagesAsync(Arg.Any<V1Job>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>()).Returns(call =>
        {
            _createdJob = call.Arg<V1Job>();
            return Task.FromResult(new HttpOperationResponse<V1Job> { Body = new V1Job { Metadata = new V1ObjectMeta { Name = "worker", Uid = "job" } } });
        });
        _core.ReplaceNamespacedSecretWithHttpMessagesAsync(Arg.Any<V1Secret>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>()).Returns(Task.FromResult(new HttpOperationResponse<V1Secret> { Body = new V1Secret { Metadata = new V1ObjectMeta() } }));
        var client = Substitute.For<IKubernetes>();
        client.BatchV1.Returns(_batch);
        client.CoreV1.Returns(_core);
        _factory = Substitute.For<IKubernetesClientFactory>();
        _factory.Create().Returns(client);
    }

    protected Task<WorkerLaunchOutcome> Start() => new KubernetesWorkerRuntime(Options.Create(_options), Microsoft.Extensions.Logging.Abstractions.NullLogger<KubernetesWorkerRuntime>.Instance, _factory).Start(_job);
}

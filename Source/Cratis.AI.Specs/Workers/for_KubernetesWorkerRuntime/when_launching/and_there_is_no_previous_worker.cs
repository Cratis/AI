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

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_launching;

/// <summary>
/// The ordinary case the guard must not get in the way of: a first dispatch, where there is nothing
/// for <see cref="KubernetesWorkerRuntime"/> to find when it asks the cluster whether a previous
/// worker is still alive.
/// </summary>
public class and_there_is_no_previous_worker : Specification
{
    static readonly AgentSessionId _session = AgentSessionId.New();

    IBatchV1Operations _batchV1;
    ICoreV1Operations _coreV1;
    KubernetesWorkerRuntime _runtime;
    WorkerLaunchOutcome _outcome;

    static Exception NotFound() =>
        new HttpOperationException("not found") { Response = new HttpResponseMessageWrapper(new HttpResponseMessage(HttpStatusCode.NotFound), string.Empty) };

    void Establish()
    {
        _batchV1 = Substitute.For<IBatchV1Operations>();
        _coreV1 = Substitute.For<ICoreV1Operations>();

        // Nothing left behind by a previous attempt - the guard's read, and the cleanup's own delete
        // calls, all answer 404.
        _batchV1
            .ReadNamespacedJobWithHttpMessagesAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>())
            .Throws(NotFound());
        _batchV1
            .DeleteNamespacedJobWithHttpMessagesAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<V1DeleteOptions>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<bool?>(), Arg.Any<bool?>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>())
            .Throws(NotFound());
        _coreV1
            .DeleteNamespacedSecretWithHttpMessagesAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<V1DeleteOptions>(), Arg.Any<string>(), Arg.Any<int?>(), Arg.Any<bool?>(), Arg.Any<bool?>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>())
            .Throws(NotFound());

        // The secret, then the job, then the secret adopted by it - the ordinary launch sequence.
        _coreV1
            .CreateNamespacedSecretWithHttpMessagesAsync(Arg.Any<V1Secret>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new HttpOperationResponse<V1Secret>
            {
                Body = new V1Secret { Metadata = new V1ObjectMeta { Name = "cratis-ai-agent", Uid = "secret-uid" } }
            }));
        _batchV1
            .CreateNamespacedJobWithHttpMessagesAsync(Arg.Any<V1Job>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new HttpOperationResponse<V1Job>
            {
                Body = new V1Job { Metadata = new V1ObjectMeta { Name = "cratis-ai-agent", Uid = "job-uid" } }
            }));
        _coreV1
            .ReplaceNamespacedSecretWithHttpMessagesAsync(Arg.Any<V1Secret>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new HttpOperationResponse<V1Secret> { Body = new V1Secret { Metadata = new V1ObjectMeta() } }));

        var client = Substitute.For<IKubernetes>();
        client.BatchV1.Returns(_batchV1);
        client.CoreV1.Returns(_coreV1);

        var clientFactory = Substitute.For<IKubernetesClientFactory>();
        clientFactory.Create().Returns(client);

        _runtime = new KubernetesWorkerRuntime(
            Options.Create(new WorkerRuntimeOptions()),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<KubernetesWorkerRuntime>.Instance,
            clientFactory);
    }

    async Task Because() =>
        _outcome = await _runtime.Start(new WorkerJob(_session, "image", new Dictionary<string, string>(), new Dictionary<string, string>()));

    [Fact]
    void should_launch_successfully() => _outcome.ShouldEqual(WorkerLaunchOutcome.Started);

    [Fact]
    async Task should_create_the_job() =>
        await _batchV1.Received(1).CreateNamespacedJobWithHttpMessagesAsync(Arg.Any<V1Job>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<bool?>(), Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(), Arg.Any<CancellationToken>());
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using k8s;
using k8s.Autorest;
using k8s.Models;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime.when_launching;

/// <summary>
/// A launch that trusted "this session is Scheduled" as proof its worker had no live container would
/// delete whatever Job held the name without asking the cluster first. Here it is asked directly, and
/// a Job that is genuinely still running refuses the launch - as a value the caller branches on, not
/// an exception it has to catch - rather than being destroyed to make room for a second one
/// (Cratis/Stagehand#500). See .cratis/ai/rules/csharp.md's "Exceptions" section - this is exactly
/// the anticipated, recoverable outcome that rule exists to keep out of a throw list.
/// </summary>
public class and_the_previous_worker_is_still_alive : Specification
{
    static readonly AgentSessionId _session = AgentSessionId.New();

    IBatchV1Operations _batchV1;
    KubernetesWorkerRuntime _runtime;
    WorkerLaunchOutcome _outcome;

    void Establish()
    {
        _batchV1 = Substitute.For<IBatchV1Operations>();
        _batchV1
            .ReadNamespacedJobWithHttpMessagesAsync(
                Arg.Any<string>(),
                Arg.Any<string>(),
                Arg.Any<bool?>(),
                Arg.Any<IReadOnlyDictionary<string, IReadOnlyList<string>>>(),
                Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new HttpOperationResponse<V1Job>
            {
                Body = new V1Job
                {
                    Metadata = new V1ObjectMeta(),
                    Status = new V1JobStatus { Active = 1 }
                }
            }));

        var client = Substitute.For<IKubernetes>();
        client.BatchV1.Returns(_batchV1);

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
    void should_refuse_to_launch() => _outcome.ShouldEqual(WorkerLaunchOutcome.AlreadyRunning);

    [Fact]
    void should_not_delete_the_live_job() =>
        _batchV1.ReceivedCalls().Any(call => call.GetMethodInfo().Name == nameof(IBatchV1Operations.DeleteNamespacedJobWithHttpMessagesAsync)).ShouldBeFalse();

    [Fact]
    void should_not_create_a_new_job() =>
        _batchV1.ReceivedCalls().Any(call => call.GetMethodInfo().Name == nameof(IBatchV1Operations.CreateNamespacedJobWithHttpMessagesAsync)).ShouldBeFalse();
}

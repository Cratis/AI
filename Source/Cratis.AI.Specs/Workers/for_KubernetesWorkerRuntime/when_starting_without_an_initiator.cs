// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Usage;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Workers.for_KubernetesWorkerRuntime;

public class when_starting_without_an_initiator : Specification
{
    WorkerLaunchOutcome _outcome;
    KubernetesWorkerRuntime _runtime;
    WorkerJob _job;
    IKubernetesClientFactory _factory;

    void Establish()
    {
        var id = AIProviderId.New();
        var readModels = Substitute.For<IReadModels>();
        readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id).Returns(
            new ConfiguredAIProvider(id, AIProviderType.OpenAI, "test")
            {
                HasAllowedTeamMembersSelection = true,
                AllowedTeamMembers = [(TeamMemberId)"alice"]
            });
        _factory = Substitute.For<IKubernetesClientFactory>();
        _runtime = new(Options.Create(new WorkerRuntimeOptions()), NullLogger<KubernetesWorkerRuntime>.Instance, _factory, new ProviderMemberAccess(readModels, new WorkInitiation()));
        _job = new(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string>()) { Provider = id };
    }

    async Task Because() => _outcome = await _runtime.Start(_job);

    [Fact] void should_deny_before_contacting_the_cluster() => _outcome.ShouldEqual(WorkerLaunchOutcome.ProviderAccessDenied);
    [Fact] void should_not_create_a_client() => _factory.DidNotReceiveWithAnyArgs().Create();
}

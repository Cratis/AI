// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;
using Cratis.AI.Providers;
using Cratis.Chronicle.ReadModels;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Workers.for_DockerWorkerRuntime;

public class when_starting_without_an_initiator : Specification
{
    WorkerLaunchOutcome _outcome;
    DockerWorkerRuntime _runtime;
    WorkerJob _job;

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
        _runtime = new(Options.Create(new WorkerRuntimeOptions()), NullLogger<DockerWorkerRuntime>.Instance,
            new ProviderMemberAccess(readModels, new WorkInitiation()));
        _job = new(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string>()) { Provider = id };
    }

    async Task Because() => _outcome = await _runtime.Start(_job);

    [Fact] void should_deny_before_contacting_the_container_runtime() => _outcome.ShouldEqual(WorkerLaunchOutcome.ProviderAccessDenied);
}

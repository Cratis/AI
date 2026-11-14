// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Usage;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Workers.for_WorkerProviderAccess;

public class when_checking_a_launch : Specification
{
    WorkerJob _job;
    ProviderMemberAccess _access;
    WorkInitiation _initiation;
    IReadModels _readModels;
    ConfiguredAIProvider _provider;

    void Establish()
    {
        var id = AIProviderId.New();
        _job = new(AgentSessionId.New(), "image", new Dictionary<string, string>(), new Dictionary<string, string>()) { Provider = id };
        _provider = new(id, AIProviderType.OpenAI, "test") { HasAllowedTeamMembersSelection = true, AllowedTeamMembers = [(TeamMemberId)"alice"] };
        _readModels = Substitute.For<IReadModels>();
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)id).Returns(_provider);
        _initiation = new();
        _access = new(_readModels, _initiation);
    }

    [Fact]
    async Task should_deny_an_excluded_initiator()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"bob"));
        (await WorkerProviderAccess.IsAllowed(_job, _access)).ShouldBeFalse();
    }

    [Fact]
    async Task should_allow_an_included_initiator()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"alice"));
        (await WorkerProviderAccess.IsAllowed(_job, _access)).ShouldBeTrue();
    }

    [Fact]
    async Task should_deny_an_unknown_provider()
    {
        (await WorkerProviderAccess.IsAllowed(_job with { Provider = AIProviderId.New() }, _access)).ShouldBeFalse();
    }

    [Fact] async Task should_leave_jobs_without_a_provider_unchanged() => (await WorkerProviderAccess.IsAllowed(_job with { Provider = null }, null)).ShouldBeTrue();
    [Fact] async Task should_fail_closed_without_an_access_service() => (await WorkerProviderAccess.IsAllowed(_job, null)).ShouldBeFalse();
}

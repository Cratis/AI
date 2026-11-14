// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.Chronicle.ReadModels;

namespace Cratis.AI.Providers.for_ProviderMemberAccess;

public class when_access_is_removed_after_work_starts : Specification
{
    readonly AIProviderId _id = AIProviderId.New();
    readonly WorkInitiation _initiation = new();
    IReadModels _readModels;
    ProviderMemberAccess _access;
    ConfiguredAIProvider _provider;
    bool _before;
    bool _after;

    void Establish()
    {
        _provider = new(_id, AIProviderType.OpenAI, "test")
        {
            HasAllowedTeamMembersSelection = true,
            AllowedTeamMembers = [(TeamMemberId)"alice"]
        };
        _readModels = Substitute.For<IReadModels>();
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_id).Returns(_ => _provider);
        _access = new(_readModels, _initiation);
    }

    async Task Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By("alice"));
        _before = await _access.IsAllowed(_id);
        _provider = _provider with { AllowedTeamMembers = [] };
        _after = await _access.IsAllowed(_id);
    }

    [Fact] void should_allow_the_initial_dispatch() => _before.ShouldBeTrue();
    [Fact] void should_deny_the_next_dispatch_in_the_same_scope() => _after.ShouldBeFalse();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.when_completing;

public class and_a_member_is_removed_after_start : given.a_dispatcher_with_member_access
{
    LanguageModels.LanguageModelResult _first;

    async Task Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"alice"));
        _pool = _pool with { Members = [new(_allowedId)] };
        _first = await Dispatch();
        _readModels.GetInstanceById<ConfiguredAIProvider>((EventSourceId)_allowedId).Returns(_snapshot[_allowedId] with
        {
            HasAllowedTeamMembersSelection = true,
            AllowedTeamMembers = []
        });
        _result = await Dispatch();
    }

    [Fact] void should_allow_the_first_dispatch() => _first.Succeeded.ShouldBeTrue();
    [Fact] void should_ignore_the_stale_unrestricted_snapshot() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_call_the_vendor_only_once() => _allowedClient.ReceivedWithAnyArgs(1).Complete(default!, default!, default!, default, TestContext.Current.CancellationToken);
}

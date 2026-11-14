// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_the_initiator_is_removed_after_start : given.a_restricted_provider
{
    LanguageModelResult _first;
    LanguageModelResult _second;

    async Task Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"alice"));
        _first = await _model.Complete("first", (LanguageModelPurpose)Purpose);
        ProviderIs(_provider, _restricted with { AllowedTeamMembers = [] });
        _second = await _model.Complete("second", (LanguageModelPurpose)Purpose);
    }

    [Fact] void should_allow_the_first_dispatch() => _first.Succeeded.ShouldBeTrue();
    [Fact] void should_deny_the_next_dispatch_in_the_same_journey() => _second.Succeeded.ShouldBeFalse();
    [Fact] void should_only_call_the_vendor_once() => _anthropicClient.ReceivedWithAnyArgs(1).Complete(default!, default!, default!, default, TestContext.Current.CancellationToken);
}

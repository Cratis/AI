// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_the_selection_is_explicitly_empty : given.a_restricted_provider
{
    LanguageModelResult _result;

    void Establish() => ProviderIs(_provider, _restricted with { AllowedTeamMembers = [] });

    async Task Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"alice"));
        _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);
    }

    [Fact] void should_deny_everyone() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_call_the_vendor() => _anthropicClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, default);
}

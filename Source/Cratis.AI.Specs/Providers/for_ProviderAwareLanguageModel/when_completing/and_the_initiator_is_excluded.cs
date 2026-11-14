// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_the_initiator_is_excluded : given.a_restricted_provider
{
    LanguageModelResult _result;

    async Task Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"bob"));
        _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);
    }

    [Fact] void should_deny() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_retry() => _result.IsTransient.ShouldBeFalse();
    [Fact] void should_explain_access() => _result.FailureReason.ShouldContain("work initiator");
    [Fact] void should_not_call_the_vendor() => _anthropicClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, TestContext.Current.CancellationToken);
}

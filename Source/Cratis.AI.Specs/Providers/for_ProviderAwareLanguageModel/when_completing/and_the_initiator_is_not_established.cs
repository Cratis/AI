// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.for_ProviderAwareLanguageModel.when_completing;

public class and_the_initiator_is_not_established : given.a_restricted_provider
{
    LanguageModelResult _result;

    async Task Because() => _result = await _model.Complete("prompt", (LanguageModelPurpose)Purpose);

    [Fact] void should_deny_unattributed_work() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_call_the_vendor() => _anthropicClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, default);
}

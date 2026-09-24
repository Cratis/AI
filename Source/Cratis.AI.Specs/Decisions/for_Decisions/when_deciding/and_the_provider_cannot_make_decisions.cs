// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using NSubstitute;

namespace Cratis.AI.Decisions.for_Decisions.when_deciding;

/// <summary>
/// The guard that stops a chat provider being pressed into decision duty by configuration alone.
/// It fires before the call, so the failure names the misconfiguration instead of surfacing later
/// as an unparseable vendor response.
/// </summary>
public class and_the_provider_cannot_make_decisions : given.all_dependencies
{
    Exception _result;

    void Establish() => ProviderIs(AIProviderType.Anthropic);

    async Task Because() => _result = await Catch.Exception(() => _decisions.Decide(RequestFor("plan", "implement")));

    [Fact] void should_refuse() => _result.ShouldBeOfExactType<ProviderDoesNotSupportDecisions>();
    [Fact] void should_not_call_any_client() => _client.ReceivedCalls().ShouldBeEmpty();
}

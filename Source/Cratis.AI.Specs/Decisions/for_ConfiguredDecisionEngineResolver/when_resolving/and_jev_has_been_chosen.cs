// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Decisions.Configuring;

namespace Cratis.AI.Decisions.for_ConfiguredDecisionEngineResolver.when_resolving;

public class and_jev_has_been_chosen : given.a_resolver
{
    DecisionEngineConnection? _result;

    void Establish() => Configured(new ConfiguredDecisionEngine(DecisionEngineId.Default, DecisionEngineType.Jev)
    {
        ApiKey = "jv_live_key",
        Model = "jev-1.13.0",
        Endpoint = "https://openrouter.ai/api"
    });

    async Task Because() => _result = await _resolver.Resolve();

    [Fact] void should_resolve_jev() => _result!.Type.ShouldEqual(DecisionEngineType.Jev);
    [Fact] void should_use_the_configured_key() => _result!.ApiKey.Value.ShouldEqual("jv_live_key");
    [Fact] void should_use_the_configured_model() => _result!.Model.Value.ShouldEqual("jev-1.13.0");
    [Fact] void should_use_the_configured_endpoint() => _result!.Endpoint.Value.ShouldEqual("https://openrouter.ai/api");
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.for_ConfiguredDecisionEngineResolver.when_resolving;

/// <summary>
/// The built-in engine is what a deployment works with out of the box - nobody has to choose it.
/// </summary>
public class and_nothing_has_been_configured : given.a_resolver
{
    DecisionEngineConnection? _result;

    void Establish() => Configured(null);

    async Task Because() => _result = await _resolver.Resolve();

    [Fact] void should_resolve_the_built_in_engine() => _result!.Type.ShouldEqual(DecisionEngineType.BuiltIn);
    [Fact] void should_use_the_deployed_endpoint() => _result!.Endpoint.Value.ShouldEqual("http://decision-engine");
    [Fact] void should_use_the_deployed_model() => _result!.Model.Value.ShouldEqual("Qwen/Qwen2.5-0.5B-Instruct");
    [Fact] void should_carry_no_api_key() => _result!.ApiKey.ShouldEqual(DecisionEngineApiKey.NotSet);
}

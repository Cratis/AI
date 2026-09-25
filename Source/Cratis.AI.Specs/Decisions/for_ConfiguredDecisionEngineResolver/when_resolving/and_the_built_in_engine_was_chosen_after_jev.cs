// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Decisions.Configuring;

namespace Cratis.AI.Decisions.for_ConfiguredDecisionEngineResolver.when_resolving;

/// <summary>
/// Choosing the built-in engine keeps the Jev settings so switching back needs no key, but the key
/// that is still recorded must not keep Jev in force.
/// </summary>
public class and_the_built_in_engine_was_chosen_after_jev : given.a_resolver
{
    DecisionEngineConnection? _result;

    void Establish() => Configured(new ConfiguredDecisionEngine(DecisionEngineId.Default, DecisionEngineType.BuiltIn)
    {
        ApiKey = "jv_live_key",
        Model = "jev-latest"
    });

    async Task Because() => _result = await _resolver.Resolve();

    [Fact] void should_resolve_the_built_in_engine() => _result!.Type.ShouldEqual(DecisionEngineType.BuiltIn);
}

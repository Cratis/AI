// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions.for_ConfiguredDecisionEngineResolver.when_resolving;

public class and_the_deployment_has_no_built_in_engine : given.a_resolver
{
    DecisionEngineConnection? _result;

    void Establish()
    {
        _builtIn.Endpoint = string.Empty;
        Configured(null);
    }

    async Task Because() => _result = await _resolver.Resolve();

    [Fact] void should_resolve_nothing() => _result.ShouldBeNull();
}

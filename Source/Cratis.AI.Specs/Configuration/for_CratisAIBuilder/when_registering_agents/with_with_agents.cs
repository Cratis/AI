// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIBuilder.when_registering_agents;

public class with_with_agents : given.a_service_collection
{
    IAIAgents _agents;

    void Because()
    {
        _services.AddCratisAI(ai => ai.WithAgents<TenantAgents>());
        _provider = _services.BuildServiceProvider();
        _agents = _provider.GetRequiredService<IAIAgents>();
    }

    [Fact] void should_keep_the_explicit_agents() => _agents.ShouldBeOfExactType<TenantAgents>();
    [Fact] void should_register_only_one_agents_lookup() => _services.Count(_ => _.ServiceType == typeof(IAIAgents)).ShouldEqual(1);
}

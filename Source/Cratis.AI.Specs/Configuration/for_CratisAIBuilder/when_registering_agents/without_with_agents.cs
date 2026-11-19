// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Agents;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIBuilder.when_registering_agents;

public class without_with_agents : given.a_service_collection
{
    IAIAgents _agents;

    void Because()
    {
        _services.AddCratisAI(_ => { });
        _provider = _services.BuildServiceProvider();
        _agents = _provider.GetRequiredService<IAIAgents>();
    }

    [Fact] void should_register_the_default_agents() => _agents.ShouldBeOfExactType<PurposeAgents>();
}

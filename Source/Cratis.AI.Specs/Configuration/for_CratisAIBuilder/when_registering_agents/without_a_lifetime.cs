// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIBuilder.when_registering_agents;

public class without_a_lifetime : given.a_service_collection
{
    ServiceLifetime _agentsLifetime;
    ServiceLifetime _executionLifetime;
    IAIAgents _first;
    IAIAgents _second;

    void Because()
    {
        _services.AddCratisAI(ai => ai.WithAgents<TenantAgents>());
        _agentsLifetime = _services.Single(service => service.ServiceType == typeof(IAIAgents)).Lifetime;
        _executionLifetime = _services.Single(service => service.ServiceType == typeof(IAgentExecution)).Lifetime;
        _provider = _services.BuildServiceProvider();
        using var firstScope = _provider.CreateScope();
        using var secondScope = _provider.CreateScope();
        _first = firstScope.ServiceProvider.GetRequiredService<IAIAgents>();
        _second = secondScope.ServiceProvider.GetRequiredService<IAIAgents>();
    }

    [Fact] void should_register_agents_as_singleton() => _agentsLifetime.ShouldEqual(ServiceLifetime.Singleton);
    [Fact] void should_register_execution_as_transient() => _executionLifetime.ShouldEqual(ServiceLifetime.Transient);
    [Fact] void should_share_agents_across_scopes() => _first.ShouldBeSame(_second);
}

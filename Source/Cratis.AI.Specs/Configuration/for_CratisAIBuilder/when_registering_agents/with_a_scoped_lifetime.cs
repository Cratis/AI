// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIBuilder.when_registering_agents;

public class with_a_scoped_lifetime : given.a_service_collection
{
    ServiceLifetime _lifetime;
    IAIAgents _first;
    IAIAgents _firstAgain;
    IAIAgents _second;

    void Because()
    {
        _services.AddCratisAI(ai => ai.WithAgents<TenantAgents>(ServiceLifetime.Scoped));
        _lifetime = _services.Single(service => service.ServiceType == typeof(IAIAgents)).Lifetime;
        _provider = _services.BuildServiceProvider();
        using var firstScope = _provider.CreateScope();
        using var secondScope = _provider.CreateScope();
        _first = firstScope.ServiceProvider.GetRequiredService<IAIAgents>();
        _firstAgain = firstScope.ServiceProvider.GetRequiredService<IAIAgents>();
        _second = secondScope.ServiceProvider.GetRequiredService<IAIAgents>();
    }

    [Fact] void should_register_agents_as_scoped() => _lifetime.ShouldEqual(ServiceLifetime.Scoped);
    [Fact] void should_reuse_agents_within_the_scope() => _first.ShouldBeSame(_firstAgain);
    [Fact] void should_not_share_agents_across_scopes() => _first.ShouldNotBeSame(_second);
}

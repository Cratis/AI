// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Pools;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIBuilder.when_registering_agents;

public class with_a_scoped_lifetime_and_scope_validation : given.a_service_collection
{
    Exception? _buildError;
    IAgentExecution _execution;
    Exception? _rootError;

    void Establish()
    {
        // The pool dispatcher is unrelated to agent resolution but is also validated on build.
        _services.AddSingleton(Substitute.For<IProviderBurn>());
        _services.AddSingleton(TimeProvider.System);
        _services.AddLogging();
        _services.AddCratisAI(ai => ai.WithAgents<TenantAgents>(ServiceLifetime.Scoped));
    }

    void Because()
    {
        _buildError = Catch.Exception(() => _provider = _services.BuildServiceProvider(new ServiceProviderOptions
        {
            ValidateScopes = true,
            ValidateOnBuild = true
        }));
        if (_buildError is not null)
        {
            return;
        }

        using var scope = _provider.CreateScope();
        _execution = scope.ServiceProvider.GetRequiredService<IAgentExecution>();
        _rootError = Catch.Exception(() => _provider.GetRequiredService<IAgentExecution>());
    }

    [Fact] void should_validate_on_build() => _buildError.ShouldBeNull();
    [Fact] void should_resolve_execution_from_the_scope() => _execution.ShouldNotBeNull();
    [Fact] void should_reject_execution_from_the_root() => _rootError.ShouldBeOfExactType<InvalidOperationException>();
}

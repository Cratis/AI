// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Configuration;
using Cratis.Chronicle.Identities;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Agents.for_AgentExecution.when_resolved_per_scope;

public class and_two_tenants_execute : Configuration.for_CratisAIBuilder.given.a_service_collection
{
    string _alphaName;
    string _betaName;

    void Establish()
    {
        _services.AddCratisAI(ai => ai.WithAgents<TenantAgents>(ServiceLifetime.Scoped));
        _provider = _services.BuildServiceProvider();
    }

    void Because()
    {
        _alphaName = ExecuteAsTenant("alpha");
        _betaName = ExecuteAsTenant("beta");
    }

    string ExecuteAsTenant(string name)
    {
        using var scope = _provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<Tenant>().Name = name;
        var execution = scope.ServiceProvider.GetRequiredService<IAgentExecution>();
        var identityProvider = scope.ServiceProvider.GetRequiredService<IIdentityProvider>();
        using (execution.As(new AgentId("triage")))
        {
            return identityProvider.GetCurrent().Name;
        }
    }

    [Fact] void should_attribute_alpha_in_alpha() => _alphaName.ShouldEqual("alpha");
    [Fact] void should_attribute_beta_in_beta() => _betaName.ShouldEqual("beta");
    [Fact] void should_not_leak_alpha_into_beta() => _betaName.ShouldNotEqual(_alphaName);
}

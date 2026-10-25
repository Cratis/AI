// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.LanguageModels;
using Cratis.Chronicle.Auditing;
using Cratis.Chronicle.Identities;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIBuilder.given;

public class a_service_collection : Specification
{
    protected ServiceCollection _services;
    protected ServiceProvider _provider;

    void Establish()
    {
        _services = new ServiceCollection();
        _services.AddSingleton<IIdentityProvider>(new BaseIdentityProvider());
        _services.AddSingleton<ICausationManager>(new CausationManager());
        _services.AddScoped<Tenant>();
    }

    void Destroy() => _provider?.Dispose();

    public class Tenant
    {
        public string Name { get; set; } = string.Empty;
    }

    public class TenantAgents(Tenant tenant) : IAIAgents
    {
        public AgentDescriptor? Find(AgentId id) => new(id, new AgentName(tenant.Name));

        public AgentDescriptor? FindByPurpose(LanguageModelPurpose purpose) => Find(AgentId.For(purpose));
    }
}

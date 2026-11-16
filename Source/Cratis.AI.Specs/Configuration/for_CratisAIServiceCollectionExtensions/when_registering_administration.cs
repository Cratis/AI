// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.Arc.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIServiceCollectionExtensions;

public class when_registering_administration : Specification
{
    ServiceCollection _services;

    void Because()
    {
        _services = new();
        _services.AddCratisAI(_ => { });
    }

    [Fact] void should_register_the_policy() => _services.Select(service => service.ImplementationInstance)
        .OfType<AuthorizationPolicyRegistration>().ShouldContain(registration =>
            registration.Name == AIManagementPolicy.Name && registration.PolicyType == typeof(AIManagementAuthorization));

    [Fact] void should_default_to_deny() => _services.Single(service => service.ServiceType == typeof(IAIAdministrators))
        .ImplementationType.ShouldEqual(typeof(DenyAIAdministrators));
}

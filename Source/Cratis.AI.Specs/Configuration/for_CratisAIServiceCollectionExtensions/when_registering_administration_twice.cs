// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.Arc.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIServiceCollectionExtensions;

public class when_registering_administration_twice : Specification
{
    AuthorizationPolicyRegistration[] _registrations;
    bool _hasPolicy;

    void Because()
    {
        var services = new ServiceCollection();
        services.AddCratisAI(_ => { });
        services.AddCratisAI(_ => { });
        _registrations = services.Select(service => service.ImplementationInstance).OfType<AuthorizationPolicyRegistration>().ToArray();
        _hasPolicy = new ArcAuthorizationPolicyRuntime(_registrations).HasPolicy(AIManagementPolicy.Name);
    }

    [Fact] void should_register_one_management_policy() => _registrations.Count(registration => registration.Name == AIManagementPolicy.Name).ShouldEqual(1);
    [Fact] void should_resolve_the_policy_without_ambiguity() => _hasPolicy.ShouldBeTrue();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Identities;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIServiceCollectionExtensions;

public class when_adding_without_an_identity_provider : Specification
{
    ServiceCollection _services;
    ServiceProvider _provider;
    IIdentityProvider _identityProvider;

    void Establish() => _services = new ServiceCollection();

    void Because()
    {
        _services.AddLogging();
        _services.AddCratisAI(_ => { });
        _provider = _services.BuildServiceProvider();
        _identityProvider = _provider.GetRequiredService<IIdentityProvider>();
    }

    void Destroy() => _provider?.Dispose();

    [Fact] void should_register_the_asp_net_core_identity_provider() => _identityProvider.ShouldBeOfExactType<Cratis.Chronicle.AspNetCore.Identities.IdentityProvider>();
}

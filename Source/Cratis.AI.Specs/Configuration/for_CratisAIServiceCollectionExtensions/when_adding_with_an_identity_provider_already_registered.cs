// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Identities;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIServiceCollectionExtensions;

public class when_adding_with_an_identity_provider_already_registered : Specification
{
    ServiceCollection _services;
    ServiceProvider _provider;
    IIdentityProvider _registered;
    IIdentityProvider _identityProvider;

    void Establish()
    {
        _registered = new BaseIdentityProvider();
        _services = new ServiceCollection();
        _services.AddSingleton(_registered);
    }

    void Because()
    {
        _services.AddCratisAI(_ => { });
        _provider = _services.BuildServiceProvider();
        _identityProvider = _provider.GetRequiredService<IIdentityProvider>();
    }

    void Destroy() => _provider?.Dispose();

    [Fact] void should_keep_the_registered_identity_provider() => _identityProvider.ShouldBeSame(_registered);
}

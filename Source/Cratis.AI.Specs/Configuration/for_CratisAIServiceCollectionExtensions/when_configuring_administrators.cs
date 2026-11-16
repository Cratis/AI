// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.AI.Providers;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Configuration.for_CratisAIServiceCollectionExtensions;

public class when_configuring_administrators : Specification
{
    Type _authority;

    void Because()
    {
        var services = new ServiceCollection();
        services.AddCratisAI(ai => ai.WithAdministrators<ApplicationAdministrators>());
        _authority = services.Single(service => service.ServiceType == typeof(IAIAdministrators)).ImplementationType!;
    }

    [Fact] void should_use_the_consumers_authority() => _authority.ShouldEqual(typeof(ApplicationAdministrators));

    public class ApplicationAdministrators : IAIAdministrators
    {
        public ValueTask<bool> IsAdministrator(ClaimsPrincipal principal, CancellationToken cancellationToken) => ValueTask.FromResult(true);
    }
}

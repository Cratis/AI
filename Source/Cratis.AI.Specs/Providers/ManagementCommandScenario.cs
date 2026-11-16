// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
using Cratis.AI.Providers;
using Cratis.Arc.Authorization;
using Cratis.Arc.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI;

public class ManagementCommandScenario<TCommand> : CommandScenario<TCommand>
    where TCommand : class
{
    readonly ISystemExecution _systemExecution;
    readonly IHttpRequestContextAccessor _requests = new HttpRequestContextAccessor();

    public ManagementCommandScenario()
    {
        Services.AddTransient<IAIAdministrators, DenyAIAdministrators>();
        Services.AddArcAuthorizationPolicy<AIManagementAuthorization>(AIManagementPolicy.Name);
        _systemExecution = new SystemExecution(new CurrentPrincipalAccessor(_requests));
    }

    public new async Task<CommandResult> Execute(TCommand command)
    {
        using var systemScope = AIInternalExecution.Begin(_systemExecution, _requests);
        return await base.Execute(command);
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.AI.Providers;
using Cratis.Arc.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace Cratis.AI.Agents.Defining.when_defining_agent.given;

public class a_restricted_caller : Specification
{
    protected ClaimsPrincipal _principal;
    protected CommandResult _result;
    protected readonly CommandScenario<DefineAgent> _scenario = new();

    protected async Task Execute()
    {
        var principals = Substitute.For<ICurrentPrincipalAccessor>();
        principals.Current.Returns(_principal);
        _scenario.Services.AddSingleton(principals);
        _scenario.Services.AddTransient<IAIAdministrators, DenyAIAdministrators>();
        _scenario.Services.AddArcAuthorizationPolicy<AIManagementAuthorization>(AIManagementPolicy.Name);
        _result = await _scenario.Execute(new DefineAgent("IssueTriage", "Scout", "Classifies issues.", ModelTier.Balanced));
    }
}

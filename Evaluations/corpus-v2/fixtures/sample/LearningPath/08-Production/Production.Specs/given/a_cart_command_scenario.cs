// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.Arc.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace LearningPath.Production.Carts.given;

public class a_cart_command_scenario<TCommand> : Specification
{
    protected readonly CartId _cartId = CartId.New();
    protected CommandScenario<TCommand> _scenario;
    protected CommandResult _result;
    protected ICurrentPrincipalAccessor _principal;

    void Establish()
    {
        _scenario = new CommandScenario<TCommand>().UseDecisionReads();
        _principal = Substitute.For<ICurrentPrincipalAccessor>();
        _principal.Current.Returns(new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "sample-customer"), new Claim(ClaimTypes.Role, nameof(CartRole.Customer))], "spec")));
        _scenario.Services.AddSingleton(_principal);
    }

    void Destroy() => _scenario.Dispose();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;
using Cratis.Arc.Authorization;
using Cratis.Arc.Chronicle.Testing.Queries;
using Cratis.Arc.Queries;
using Cratis.Arc.Testing.Queries;
using Microsoft.Extensions.DependencyInjection;

namespace LearningPath.Production.Carts.for_CartSummary.given;

public class a_cart_query_scenario : Specification
{
    protected readonly CartId _cartId = CartId.New();
    protected readonly QueryScenario<CartSummary> _scenario = new();
    protected ICurrentPrincipalAccessor _principal;
    protected QueryResult _result;

    void Establish()
    {
        _principal = Substitute.For<ICurrentPrincipalAccessor>();
        _principal.Current.Returns(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "sample-visitor")], "spec")));
        _scenario.Services.AddSingleton(_principal);
        _scenario.Given.ForEventSource(_cartId).Events(new ItemAddedToCart("Coffee beans", 2));
    }

    void Destroy() => _scenario.Dispose();
}

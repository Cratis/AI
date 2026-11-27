// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace LearningPath.Production.Carts.for_AddItemToCart;

public class when_the_caller_is_anonymous : given.an_add_item_scenario
{
    void Establish() => _principal.Current.Returns((ClaimsPrincipal)null);

    async Task Because() => _result = await _scenario.Execute(new AddItemToCart(_cartId, string.Empty, 0));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_deny_before_validating_input() => _result.ShouldNotBeAuthorized();
    [Fact] void should_not_disclose_validation_errors() => _result.ValidationResults.Count().ShouldEqual(0);
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}

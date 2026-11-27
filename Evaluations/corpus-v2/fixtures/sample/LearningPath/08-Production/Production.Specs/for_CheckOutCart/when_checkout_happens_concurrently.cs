// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Validation;

namespace LearningPath.Production.Carts.for_CheckOutCart;

public class when_checkout_happens_concurrently : given.a_cart_command_scenario<CheckOutCart>
{
    void Establish()
    {
        _scenario.Given.ForEventSource(_cartId).Events(new ItemAddedToCart("Coffee beans", 2));
        _scenario.AppendConcurrently(_cartId, new CartCheckedOut());
    }

    async Task Because() => _result = await _scenario.Execute(new CheckOutCart(_cartId));

    [Fact] void should_not_succeed() => _result.ShouldNotBeSuccessful();
    [Fact] void should_have_validation_errors() => _result.ShouldHaveValidationErrors();
    [Fact] void should_report_a_conflict() => _result.ShouldHaveValidationErrorBecauseOf(ValidationResultReason.ConcurrencyViolation);
    [Fact] void should_not_commit_another_checkout() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.SuiteHidden;

public class when_changing_an_open_cart_note : given.a_cart_command_scenario<ChangeCartNote>
{
    void Establish() => _scenario.Given.ForEventSource(_cartId).Events(new ItemAddedToCart("Coffee", 2));
    async Task Because() => _result = await _scenario.Execute(new ChangeCartNote(_cartId, "Leave at reception"));
    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] async Task should_append() => await _scenario.ShouldHaveAppendedEvent<ChangeCartNote, CartNoteChanged>(_cartId);
}

public class when_changing_a_checked_out_cart_note : given.a_cart_command_scenario<ChangeCartNote>
{
    void Establish() => _scenario.Given.ForEventSource(_cartId).Events(new ItemAddedToCart("Coffee", 2), new CartCheckedOut());
    async Task Because() => _result = await _scenario.Execute(new ChangeCartNote(_cartId, "Leave at reception"));
    [Fact] void should_reject() => _result.ShouldHaveValidationErrors();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}

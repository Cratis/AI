// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.SuiteHidden;

public class when_delivery_address_is_empty : given.a_cart_command_scenario<SetDeliveryAddress>
{
    async Task Because() => _result = await _scenario.Execute(new SetDeliveryAddress(_cartId, string.Empty));
    [Fact] void should_reject() => _result.ShouldHaveValidationErrors();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}

public class when_delivery_address_is_whitespace : given.a_cart_command_scenario<SetDeliveryAddress>
{
    async Task Because() => _result = await _scenario.Execute(new SetDeliveryAddress(_cartId, "   "));
    [Fact] void should_reject() => _result.ShouldHaveValidationErrors();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.Count.ShouldEqual(0);
}

public class when_delivery_address_is_valid : given.a_cart_command_scenario<SetDeliveryAddress>
{
    async Task Because() => _result = await _scenario.Execute(new SetDeliveryAddress(_cartId, "1 High Street"));
    [Fact] void should_succeed() => _result.ShouldBeSuccessful();
    [Fact] async Task should_append() => await _scenario.ShouldHaveAppendedEvent<SetDeliveryAddress, DeliveryAddressSet>(_cartId);
}

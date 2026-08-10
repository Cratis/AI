// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Planner.Alerts.Raising;

namespace Planner.Alerts.Webhooks.for_AlertDelivery.when_parsing_a_delivery;

public class and_it_carries_no_alert : Specification
{
    RaiseAlert _untitled;
    RaiseAlert _notAnObject;
    RaiseAlert _notJsonAtAll;

    void Because()
    {
        _untitled = AlertDelivery.Parse("""{"summary": "something happened"}""", "production");
        _notAnObject = AlertDelivery.Parse("[1, 2, 3]", "production");
        _notJsonAtAll = AlertDelivery.Parse("this is not json", "production");
    }

    [Fact] void should_reject_a_delivery_with_no_title() => _untitled.ShouldBeNull();
    [Fact] void should_reject_a_delivery_that_is_not_an_object() => _notAnObject.ShouldBeNull();
    [Fact] void should_reject_a_delivery_that_is_not_json() => _notJsonAtAll.ShouldBeNull();
}
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_QuantityValidator;

public class when_validating_a_quantity : Specification
{
    readonly QuantityValidator _validator = new();

    [Fact] void should_accept_a_positive_quantity() => _validator.Validate(new Quantity(1)).IsValid.ShouldBeTrue();
    [Fact] void should_reject_zero() => _validator.Validate(new Quantity(0)).IsValid.ShouldBeFalse();
    [Fact] void should_reject_a_negative_quantity() => _validator.Validate(new Quantity(-1)).IsValid.ShouldBeFalse();
}

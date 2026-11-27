// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace LearningPath.Production.Carts.for_ProductNameValidator;

public class when_validating_a_product_name : Specification
{
    readonly ProductNameValidator _validator = new();

    [Fact] void should_accept_a_product_name() => _validator.Validate(new ProductName("Coffee beans")).IsValid.ShouldBeTrue();
    [Fact] void should_reject_an_empty_name() => _validator.Validate(new ProductName(string.Empty)).IsValid.ShouldBeFalse();
    [Fact] void should_reject_whitespace() => _validator.Validate(new ProductName("   ")).IsValid.ShouldBeFalse();
}

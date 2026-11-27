// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Validation;
using FluentValidation;

namespace LearningPath.Production.Carts;

/// <summary>
/// Requires a nonempty product name wherever Arc validates this concept.
/// </summary>
public class ProductNameValidator : ConceptValidator<ProductName>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ProductNameValidator"/> class.
    /// </summary>
    public ProductNameValidator() => RuleFor(product => product.Value).NotEmpty();
}

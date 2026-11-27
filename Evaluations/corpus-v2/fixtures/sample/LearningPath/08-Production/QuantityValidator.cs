// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Validation;
using FluentValidation;

namespace LearningPath.Production.Carts;

/// <summary>
/// Requires a positive quantity wherever Arc validates this concept.
/// </summary>
public class QuantityValidator : ConceptValidator<Quantity>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="QuantityValidator"/> class.
    /// </summary>
    public QuantityValidator() => RuleFor(quantity => quantity.Value).GreaterThan(0);
}

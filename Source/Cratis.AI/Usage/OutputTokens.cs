// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Validation;

namespace Cratis.AI.Usage;

/// <summary>
/// The number of tokens a call to a language model produced in its completion. New (plan Section 5.3a).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record OutputTokens(long Value) : ConceptAs<long>(Value)
{
    /// <summary>
    /// The value representing unmeasured output tokens.
    /// </summary>
    public static readonly OutputTokens NotSet = new(0L);

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="OutputTokens"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator OutputTokens(long value) => new(value);
}

/// <summary>
/// Represents the validator for the <see cref="OutputTokens"/> concept.
/// </summary>
public class OutputTokensValidator : ConceptValidator<OutputTokens>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="OutputTokensValidator"/> class.
    /// </summary>
    public OutputTokensValidator() => RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("Output tokens cannot be negative");
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Usage;

/// <summary>
/// The number of tokens a call to a language model consumed as its prompt. New - Direct and Studio
/// both carry this as a raw <see cref="long"/> today (plan Section 5.3a).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record InputTokens(long Value) : ConceptAs<long>(Value)
{
    /// <summary>
    /// The value representing unmeasured input tokens.
    /// </summary>
    public static readonly InputTokens NotSet = new(0L);

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="InputTokens"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator InputTokens(long value) => new(value);
}

/// <summary>
/// Represents the validator for the <see cref="InputTokens"/> concept.
/// </summary>
public class InputTokensValidator : ConceptValidator<InputTokens>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="InputTokensValidator"/> class.
    /// </summary>
    public InputTokensValidator() => RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("Input tokens cannot be negative");
}

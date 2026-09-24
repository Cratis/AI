// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Common;

/// <summary>
/// A number of language model tokens.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record TokenCount(long Value) : ConceptAs<long>(Value)
{
    /// <summary>
    /// The value representing an unknown token count.
    /// </summary>
    public static readonly TokenCount NotSet = new(0L);

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="TokenCount"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator TokenCount(long value) => new(value);
}

/// <summary>
/// Represents the validator for the <see cref="TokenCount"/> concept - travels with it everywhere it
/// appears, so a worker callback reporting a negative count or an implausibly large one (garbage, an
/// overflowed value, or a unit mix-up) is rejected with a 400 rather than recorded and skewing every
/// usage statistic derived from it.
/// </summary>
public class TokenCountValidator : ConceptValidator<TokenCount>
{
    /// <summary>
    /// The most tokens a single recorded count can hold - far beyond any real session's usage, but
    /// enough to catch a garbage or overflowed value before it is recorded.
    /// </summary>
    public const long MaximumValue = 100_000_000L;

    /// <summary>
    /// Initializes a new instance of the <see cref="TokenCountValidator"/> class.
    /// </summary>
    public TokenCountValidator()
    {
        RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("A token count cannot be negative");
        RuleFor(_ => _.Value).LessThanOrEqualTo(MaximumValue).WithMessage("A token count cannot exceed 100,000,000");
    }
}

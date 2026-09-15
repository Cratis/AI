// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Validation;

namespace Cratis.AI.Usage;

/// <summary>
/// The number of prompt tokens a call to a language model served from the provider's own cache
/// rather than processing fresh - the harness entrypoint already reads <c>cache_*</c> fields off the
/// vendor response (plan Section 5.3a); this is the concept those values become once inside the package.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record CachedTokens(long Value) : ConceptAs<long>(Value)
{
    /// <summary>
    /// The value representing unmeasured or absent cached tokens.
    /// </summary>
    public static readonly CachedTokens NotSet = new(0L);

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="CachedTokens"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator CachedTokens(long value) => new(value);
}

/// <summary>
/// Represents the validator for the <see cref="CachedTokens"/> concept.
/// </summary>
public class CachedTokensValidator : ConceptValidator<CachedTokens>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="CachedTokensValidator"/> class.
    /// </summary>
    public CachedTokensValidator() => RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("Cached tokens cannot be negative");
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Usage;

/// <summary>
/// The reported cost of an agent session or completion, in US dollars - the harness entrypoint
/// already reports <c>costUsd</c> on its callback payload (plan Section 5.3a); this is the concept
/// those values become once inside the package.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record CostUsd(decimal Value) : ConceptAs<decimal>(Value)
{
    /// <summary>
    /// The value representing an unknown or unreported cost.
    /// </summary>
    public static readonly CostUsd NotSet = new(0m);

    /// <summary>
    /// Implicitly convert from <see cref="decimal"/> to <see cref="CostUsd"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator CostUsd(decimal value) => new(value);
}

/// <summary>
/// Represents the validator for the <see cref="CostUsd"/> concept.
/// </summary>
public class CostUsdValidator : ConceptValidator<CostUsd>
{
    /// <summary>
    /// The most a single recorded session can plausibly cost - far beyond any real session, enough
    /// to catch a garbage or overflowed value before it is recorded (the same reasoning as
    /// <see cref="CpuSecondsValidator"/>, Cratis/Stagehand#747).
    /// </summary>
    public const decimal MaximumValue = 100_000m;

    /// <summary>
    /// Initializes a new instance of the <see cref="CostUsdValidator"/> class.
    /// </summary>
    public CostUsdValidator()
    {
        RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("A cost cannot be negative");
        RuleFor(_ => _.Value).LessThanOrEqualTo(MaximumValue).WithMessage("A cost cannot exceed $100,000");
    }
}

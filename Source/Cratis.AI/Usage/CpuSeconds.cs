// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Usage;

/// <summary>
/// The amount of CPU time, in seconds, an agent session consumed. Ported from Direct's
/// <c>Common.CpuSeconds</c> (plan Section 5.3a) - the exact concept + validator pair the brief calls
/// out to formalize.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record CpuSeconds(decimal Value) : ConceptAs<decimal>(Value)
{
    /// <summary>
    /// The value representing an unknown or unmeasured CPU time.
    /// </summary>
    public static readonly CpuSeconds NotSet = new(0m);

    /// <summary>
    /// Implicitly convert from <see cref="decimal"/> to <see cref="CpuSeconds"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator CpuSeconds(decimal value) => new(value);
}

/// <summary>
/// Represents the validator for the <see cref="CpuSeconds"/> concept - travels with it everywhere it
/// appears, so a worker callback reporting a negative CPU time or an implausibly large one (garbage,
/// an overflowed value, or a unit mix-up) is rejected with a 400 rather than recorded and skewing
/// every resource-usage figure derived from it (Direct hit exactly this bug - Cratis/Stagehand#747).
/// </summary>
public class CpuSecondsValidator : ConceptValidator<CpuSeconds>
{
    /// <summary>
    /// The most CPU time a single recorded session can hold - far beyond any real session's usage,
    /// but enough to catch a garbage or overflowed value before it is recorded.
    /// </summary>
    public const decimal MaximumValue = 1_000_000m;

    /// <summary>
    /// Initializes a new instance of the <see cref="CpuSecondsValidator"/> class.
    /// </summary>
    public CpuSecondsValidator()
    {
        RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("A CPU time cannot be negative");
        RuleFor(_ => _.Value).LessThanOrEqualTo(MaximumValue).WithMessage("A CPU time cannot exceed 1,000,000 seconds");
    }
}

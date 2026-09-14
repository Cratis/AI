// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Usage;

/// <summary>
/// The peak resident set size, in bytes, an agent session consumed. Ported from Direct's
/// <c>Common.MemoryBytes</c> (plan Section 5.3a).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record MemoryBytes(long Value) : ConceptAs<long>(Value)
{
    /// <summary>
    /// The value representing an unknown or unmeasured memory usage.
    /// </summary>
    public static readonly MemoryBytes NotSet = new(0L);

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="MemoryBytes"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator MemoryBytes(long value) => new(value);
}

/// <summary>
/// Represents the validator for the <see cref="MemoryBytes"/> concept - see <see cref="CpuSecondsValidator"/>
/// for why this exists (Cratis/Stagehand#747).
/// </summary>
public class MemoryBytesValidator : ConceptValidator<MemoryBytes>
{
    /// <summary>
    /// The most memory a single recorded session can hold - far beyond any real container's memory,
    /// but enough to catch a garbage or overflowed value before it is recorded.
    /// </summary>
    public const long MaximumValue = 1024L * 1024 * 1024 * 1024;

    /// <summary>
    /// Initializes a new instance of the <see cref="MemoryBytesValidator"/> class.
    /// </summary>
    public MemoryBytesValidator()
    {
        RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("A memory size cannot be negative");
        RuleFor(_ => _.Value).LessThanOrEqualTo(MaximumValue).WithMessage("A memory size cannot exceed 1 TiB");
    }
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Validation;

namespace Cratis.AI.Usage;

/// <summary>
/// How long an agent session or completion took, in milliseconds - the harness entrypoint already
/// reports <c>durationMs</c> on its callback payload (plan Section 5.3a).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record DurationMilliseconds(long Value) : ConceptAs<long>(Value)
{
    /// <summary>
    /// The value representing an unknown or unmeasured duration.
    /// </summary>
    public static readonly DurationMilliseconds NotSet = new(0L);

    /// <summary>
    /// Gets the value as a <see cref="TimeSpan"/>.
    /// </summary>
    public TimeSpan AsTimeSpan => TimeSpan.FromMilliseconds(Value);

    /// <summary>
    /// Implicitly convert from <see cref="long"/> to <see cref="DurationMilliseconds"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DurationMilliseconds(long value) => new(value);
}

/// <summary>
/// Represents the validator for the <see cref="DurationMilliseconds"/> concept.
/// </summary>
public class DurationMillisecondsValidator : ConceptValidator<DurationMilliseconds>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="DurationMillisecondsValidator"/> class.
    /// </summary>
    public DurationMillisecondsValidator() => RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("A duration cannot be negative");
}

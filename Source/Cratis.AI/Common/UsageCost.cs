// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Common;

/// <summary>
/// A cost in USD as the Claude CLI reports it for a session.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record UsageCost(decimal Value) : ConceptAs<decimal>(Value)
{
    /// <summary>
    /// The value representing an unknown cost.
    /// </summary>
    public static readonly UsageCost NotSet = new(0m);

    /// <summary>
    /// Implicitly convert from <see cref="decimal"/> to <see cref="UsageCost"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator UsageCost(decimal value) => new(value);
}

/// <summary>
/// Represents the validator for the <see cref="UsageCost"/> concept - travels with it everywhere it
/// appears, so a worker callback reporting a negative cost or an implausibly large one is rejected
/// with a 400 rather than recorded and permanently distorting the account usage statistics it feeds.
/// </summary>
public class UsageCostValidator : ConceptValidator<UsageCost>
{
    /// <summary>
    /// The highest cost a single recorded session can hold - far beyond what any real session costs,
    /// but enough to catch a garbage or malformed value before it is recorded.
    /// </summary>
    public const decimal MaximumValue = 10_000m;

    /// <summary>
    /// Initializes a new instance of the <see cref="UsageCostValidator"/> class.
    /// </summary>
    public UsageCostValidator()
    {
        RuleFor(_ => _.Value).GreaterThanOrEqualTo(0).WithMessage("A usage cost cannot be negative");
        RuleFor(_ => _.Value).LessThanOrEqualTo(MaximumValue).WithMessage("A usage cost cannot exceed $10,000.00");
    }
}

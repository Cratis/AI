// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Common;

/// <summary>
/// The number of an issue within its repository.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record IssueNumber(int Value) : ConceptAs<int>(Value)
{
    /// <summary>
    /// The value representing an unset issue number.
    /// </summary>
    public static readonly IssueNumber NotSet = new(0);

    /// <summary>
    /// Implicitly convert from <see cref="int"/> to <see cref="IssueNumber"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator IssueNumber(int value) => new(value);
}

/// <summary>
/// Validates that an <see cref="IssueNumber"/> is a real issue number wherever it appears.
/// </summary>
public class IssueNumberValidator : ConceptValidator<IssueNumber>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="IssueNumberValidator"/> class.
    /// </summary>
    public IssueNumberValidator() => RuleFor(_ => _.Value).GreaterThan(0).WithMessage("An issue number is required");
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents;

/// <summary>
/// What a skill teaches its agent - free-form markdown describing what the agent knows and how it
/// should apply it. The content is the instructions; there is no separate description, the same
/// shape as Studio's <c>SkillContent</c>.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record SkillContent(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing empty skill content.
    /// </summary>
    public static readonly SkillContent NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="SkillContent"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator SkillContent(string value) => new(value);

    /// <summary>
    /// Implicitly convert from <see cref="SkillContent"/> to <see cref="string"/>.
    /// </summary>
    /// <param name="content">The content to convert from.</param>
    public static implicit operator string(SkillContent content) => content.Value;
}

/// <summary>
/// Represents the validator for <see cref="SkillContent"/> - travels with the concept everywhere it
/// appears, so no command can store content past the bound.
/// </summary>
public class SkillContentValidator : ConceptValidator<SkillContent>
{
    /// <summary>
    /// The most characters a skill's content can hold.
    /// </summary>
    public const int MaximumLength = 20_000;

    /// <summary>
    /// Initializes a new instance of the <see cref="SkillContentValidator"/> class.
    /// </summary>
    public SkillContentValidator() => RuleFor(_ => _.Value).MaximumLength(MaximumLength).WithMessage("A skill's content can hold at most 20000 characters");
}

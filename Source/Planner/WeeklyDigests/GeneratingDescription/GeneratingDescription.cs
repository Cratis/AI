// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.WeeklyDigests.GeneratingDescription;

/// <summary>
/// Command for recording the language model's suggested description of a weekly digest - executed
/// by the weekly digest analysis reactor. Once this fires the digest moves to
/// <see cref="WeeklyDigestStatus.Unpublished"/> - ready for review.
/// </summary>
/// <param name="WeeklyDigest">The identity of the weekly digest.</param>
/// <param name="Description">The suggested description.</param>
[Command]
public record GenerateWeeklyDigestDescription(WeeklyDigestId WeeklyDigest, WeeklyDigestDescription Description)
{
    /// <summary>
    /// Handles the command by appending a <see cref="WeeklyDigestDescriptionGenerated"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public WeeklyDigestDescriptionGenerated Handle() => new(Description);
}

/// <summary>
/// Event raised when the language model has suggested a description for a weekly digest.
/// </summary>
/// <param name="Description">The suggested description.</param>
[EventType]
public record WeeklyDigestDescriptionGenerated(WeeklyDigestDescription Description);

/// <summary>
/// Command for editing the description of a weekly digest - a person overriding what the language
/// model suggested, or writing one when none was generated.
/// </summary>
/// <param name="WeeklyDigest">The identity of the weekly digest.</param>
/// <param name="Description">The description to set.</param>
[Command]
public record SetWeeklyDigestDescription(WeeklyDigestId WeeklyDigest, WeeklyDigestDescription Description)
{
    /// <summary>
    /// Handles the command by appending a <see cref="WeeklyDigestDescriptionEdited"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public WeeklyDigestDescriptionEdited Handle() => new(Description);
}

/// <summary>
/// Represents the validator for the <see cref="SetWeeklyDigestDescription"/> command.
/// </summary>
public class SetWeeklyDigestDescriptionValidator : CommandValidator<SetWeeklyDigestDescription>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="SetWeeklyDigestDescriptionValidator"/> class.
    /// </summary>
    public SetWeeklyDigestDescriptionValidator() => RuleFor(_ => _.Description).NotEmpty().WithMessage("A description is required");
}

/// <summary>
/// Event raised when a person edited the description of a weekly digest.
/// </summary>
/// <param name="Description">The description that was set.</param>
[EventType]
public record WeeklyDigestDescriptionEdited(WeeklyDigestDescription Description);

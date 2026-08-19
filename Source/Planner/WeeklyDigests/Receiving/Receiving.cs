// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.WeeklyDigests.Receiving;

/// <summary>
/// Command for recording a weekly digest job's raw output - executed by the weekly digest webhook
/// receiver.
/// </summary>
/// <param name="Content">The raw content the job posted.</param>
[Command]
public record ReceiveWeeklyDigest(WeeklyDigestContent Content)
{
    /// <summary>
    /// Handles the command by opening a new weekly digest stream and appending a
    /// <see cref="WeeklyDigestReceived"/> event.
    /// </summary>
    /// <returns>A tuple of the weekly digest identity (event source) and the event.</returns>
    public (WeeklyDigestId, WeeklyDigestReceived) Handle() => (WeeklyDigestId.New(), new(Content));
}

/// <summary>
/// Represents the validator for the <see cref="ReceiveWeeklyDigest"/> command.
/// </summary>
public class ReceiveWeeklyDigestValidator : CommandValidator<ReceiveWeeklyDigest>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ReceiveWeeklyDigestValidator"/> class.
    /// </summary>
    public ReceiveWeeklyDigestValidator() => RuleFor(_ => _.Content).NotEmpty().WithMessage("A weekly digest needs content");
}

/// <summary>
/// Event raised when a weekly digest job's raw output has been received.
/// </summary>
/// <param name="Content">The raw content the job posted.</param>
[EventType]
public record WeeklyDigestReceived(WeeklyDigestContent Content);

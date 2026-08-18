// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

#if DEBUG
using Cratis.Arc.Authorization;

namespace Planner.Identity.for_DenyByDefaultAuthorization.when_executing_through_the_real_pipeline.given;

/// <summary>
/// A command-shaped type that opts out of authorization - proving <see cref="DenyByDefaultAuthorization"/>
/// does not interfere with a genuine <see cref="AllowAnonymousAttribute"/> escape hatch, should the
/// Planner ever need one. No production command uses it today.
/// </summary>
[Command]
[AllowAnonymous]
public record AnonymousTestCommand
{
    /// <summary>
    /// Handles the command by appending an <see cref="AnonymousTestCommandAccepted"/> event.
    /// </summary>
    /// <returns>The event.</returns>
    public AnonymousTestCommandAccepted Handle() => new();
}

/// <summary>
/// Emitted when <see cref="AnonymousTestCommand"/> is accepted - test-only, proves nothing about
/// production behavior beyond the [AllowAnonymous] escape hatch itself.
/// </summary>
[EventType]
public record AnonymousTestCommandAccepted;
#endif

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories.SettingReviewGatePolicy;

/// <summary>
/// Command for setting a repository's review gate policy - whether a pull request always waits for
/// a person, or an agent may merge one on its own once classified as safe to.
/// </summary>
/// <param name="Repository">The identity of the repository.</param>
/// <param name="Policy">The policy to set.</param>
[Command]
public record SetReviewGatePolicy(RepositoryId Repository, ReviewGatePolicy Policy)
{
    /// <summary>
    /// Handles the command by appending a <see cref="ReviewGatePolicySet"/> event to the repository's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public ReviewGatePolicySet Handle() => new(Policy);
}

/// <summary>
/// Event raised when a repository's review gate policy has been set.
/// </summary>
/// <param name="Policy">The policy that was set.</param>
[EventType]
public record ReviewGatePolicySet(ReviewGatePolicy Policy);

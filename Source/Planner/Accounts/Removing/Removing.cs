// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;

namespace Planner.Accounts.Removing;

/// <summary>
/// Command for removing a Claude account - no further work is scheduled on it.
/// </summary>
/// <remarks>
/// Requires an authenticated operator: removing an account takes capacity away from every future dispatch.
/// </remarks>
/// <param name="Account">The identity of the account to remove.</param>
[Command]
[Authorize]
public record RemoveAccount(AccountId Account)
{
    /// <summary>
    /// Handles the command by appending a <see cref="ClaudeAccountRemoved"/> event to the account's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public ClaudeAccountRemoved Handle() => new();
}

/// <summary>
/// Event raised when a Claude account has been removed.
/// </summary>
[EventType]
public record ClaudeAccountRemoved;

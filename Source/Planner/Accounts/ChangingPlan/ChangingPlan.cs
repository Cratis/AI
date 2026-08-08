// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Accounts.ChangingPlan;

/// <summary>
/// Command for changing the subscription plan of a Claude account.
/// </summary>
/// <param name="Account">The identity of the account.</param>
/// <param name="Plan">The new plan.</param>
[Command]
public record ChangeAccountPlan(AccountId Account, ClaudePlan Plan)
{
    /// <summary>
    /// Handles the command by appending a <see cref="ClaudeAccountPlanChanged"/> event to the account's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public ClaudeAccountPlanChanged Handle() => new(Plan);
}

/// <summary>
/// Event raised when the subscription plan of a Claude account has changed - the scheduler adjusts
/// its usage boundaries accordingly.
/// </summary>
/// <param name="Plan">The new plan.</param>
[EventType]
public record ClaudeAccountPlanChanged(ClaudePlan Plan);

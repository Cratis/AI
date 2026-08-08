// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Planner.Accounts.SettingToken;

namespace Planner.Accounts.Registering;

/// <summary>
/// Command for registering a Claude account the Planner can schedule work on. Work runs through
/// the regular Claude plan (not the API): a worker container gets the account's token and runs
/// the Claude CLI with it.
/// </summary>
/// <param name="Name">The display name of the account.</param>
/// <param name="Plan">The subscription plan of the account.</param>
/// <param name="Token">The Claude CLI token - optional; it can be set later.</param>
[Command]
public record RegisterAccount(AccountName Name, ClaudePlan Plan, ClaudeToken? Token = null)
{
    /// <summary>
    /// Handles the command by opening a new account stream, appending the registration and - when a
    /// token was supplied - the token fact.
    /// </summary>
    /// <returns>The events for the new account.</returns>
    public IEnumerable<EventForEventSourceId> Handle()
    {
        var account = AccountId.New();
        yield return new EventForEventSourceId(account, new ClaudeAccountRegistered(Name, Plan));

        var token = Token ?? ClaudeToken.NotSet;
        if (token != ClaudeToken.NotSet)
        {
            yield return new EventForEventSourceId(account, new ClaudeAccountTokenSet(token));
        }
    }
}

/// <summary>
/// Represents the validator for the <see cref="RegisterAccount"/> command.
/// </summary>
public class RegisterAccountValidator : CommandValidator<RegisterAccount>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="RegisterAccountValidator"/> class.
    /// </summary>
    public RegisterAccountValidator() => RuleFor(_ => _.Name).NotEmpty().WithMessage("An account name is required");
}

/// <summary>
/// Event raised when a Claude account has been registered.
/// </summary>
/// <param name="Name">The display name of the account.</param>
/// <param name="Plan">The subscription plan of the account.</param>
[EventType]
public record ClaudeAccountRegistered(AccountName Name, ClaudePlan Plan);

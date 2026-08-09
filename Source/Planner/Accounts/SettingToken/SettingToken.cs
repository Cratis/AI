// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Accounts.SettingToken;

/// <summary>
/// Command for setting (or rotating) the Claude CLI token of an account.
/// </summary>
/// <param name="Account">The identity of the account.</param>
/// <param name="Token">The token the Claude CLI authenticates with.</param>
[Command]
public record SetAccountToken(AccountId Account, ClaudeToken Token)
{
    /// <summary>
    /// Handles the command by appending a <see cref="ClaudeAccountTokenSet"/> event to the account's stream.
    /// </summary>
    /// <returns>The event.</returns>
    public ClaudeAccountTokenSet Handle() => new(Token);
}

/// <summary>
/// Represents the validator for the <see cref="SetAccountToken"/> command.
/// </summary>
public class SetAccountTokenValidator : CommandValidator<SetAccountToken>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="SetAccountTokenValidator"/> class.
    /// </summary>
    public SetAccountTokenValidator() => RuleFor(_ => _.Token).NotEmpty().WithMessage("A token is required");
}

/// <summary>
/// Event raised when the Claude CLI token of an account has been set - workers scheduled on the
/// account authenticate with the most recently set token.
/// </summary>
/// <param name="Token">The token.</param>
[EventType]
public record ClaudeAccountTokenSet(ClaudeToken Token);

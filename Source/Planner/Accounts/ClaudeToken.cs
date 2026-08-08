// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Accounts;

/// <summary>
/// The credential the Claude CLI in a worker container authenticates with - a long-lived OAuth
/// token created with <c>claude setup-token</c> on the account.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record ClaudeToken(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing an unset token.
    /// </summary>
    public static readonly ClaudeToken NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="ClaudeToken"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator ClaudeToken(string value) => new(value);
}

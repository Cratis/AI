// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Chronicle.Compliance.GDPR;

namespace Planner.Accounts;

/// <summary>
/// The credential the Claude CLI in a worker container authenticates with - a long-lived OAuth
/// token created with <c>claude setup-token</c> on the account. Marked <see cref="PIIAttribute"/> so
/// Chronicle encrypts it at rest, keyed by the owning account (the event source id already resolves
/// as the subject) - decryption is transparent to the code paths that read it back.
/// </summary>
/// <param name="Value">The underlying value.</param>
[PII]
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

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The API key a configured AI provider authenticates with. Ported from Direct's
/// <c>AIProviders.AIProviderApiKey</c> (plan Section 5.2 step 3), deliberately without Direct's
/// original <c>[SecurityToken]</c> attribute: that attribute is tied to Direct's own
/// <c>Tenants.Encryption</c> pipeline, which the package must never reference (plan Section 5.1's
/// rule, and risk #10 - "the package never sees a key vault, never logs a credential"). Protection
/// is explicit instead: a command handler that persists this value calls
/// <see cref="Abstractions.ISecretProtector.Protect"/> itself before it reaches an event, and a
/// caller that needs the plaintext back calls <see cref="Abstractions.ISecretRevealer.Reveal"/>.
/// Direct and Studio each supply the vault behind those two interfaces.
/// </summary>
/// <param name="Value">The underlying value - protected once a command has called
/// <see cref="Abstractions.ISecretProtector.Protect"/>, plaintext only in flight before that point.</param>
public record AIProviderApiKey(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no API key.
    /// </summary>
    public static readonly AIProviderApiKey NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AIProviderApiKey"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AIProviderApiKey(string value) => new(value);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Decisions;

/// <summary>
/// The credential a hosted decision engine is called with.
/// </summary>
/// <param name="Value">The underlying value.</param>
/// <remarks>
/// Encrypted at rest and kept out of the causation chain, the same way
/// <see cref="Providers.AIProviderApiKey"/> is - it is a secret, not personal data.
/// </remarks>
[NotAudited]
[Encrypted(EncryptionScope.Namespace)]
public record DecisionEngineApiKey(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no API key.
    /// </summary>
    public static readonly DecisionEngineApiKey NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="DecisionEngineApiKey"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator DecisionEngineApiKey(string value) => new(value);
}

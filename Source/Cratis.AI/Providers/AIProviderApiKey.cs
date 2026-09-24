// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The API key a configured AI provider authenticates with.
/// </summary>
/// <remarks>
/// Chronicle owns the cryptography. <c language="csharp">[Encrypted]</c> encrypts the value on its
/// way into an event and decrypts it on the way back out, so a handler stores it and a caller reads
/// it without either one holding a key. The scope is the event store namespace, which is the same
/// boundary the per-tenant protectors this replaced already used - Direct resolved its key by
/// <c>EventStoreNamespaceName</c>, and Studio's organization key is the tenant id "doubling as the
/// organization's namespace name".
/// <para>
/// <c language="csharp">[NotAudited]</c> is not decoration. A command's property values are written
/// to the causation chain before <c>Handle</c> runs, so without it the plaintext key is recorded in
/// the event log permanently - which is exactly what happened in Direct, where six real keys were
/// found in the clear.
/// </para>
/// </remarks>
/// <param name="Value">The underlying value.</param>
[NotAudited]
[Encrypted(EncryptionScope.Namespace)]
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

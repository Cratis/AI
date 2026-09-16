// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Abstractions;

/// <summary>
/// Protects a secret (an API key, a subscription token) at rest. The package never sees a key vault
/// and never logs a credential - it calls this at the point a secret is about to be persisted and
/// calls <see cref="ISecretRevealer"/> at the point one is about to be used (plan Section 5.1, risk #10).
/// </summary>
/// <remarks>
/// Direct supplies an implementation over <c>Tenants.Encryption</c>; Studio supplies one over
/// <c>Organizations.Encryption</c>. Neither is referenced by the package.
/// </remarks>
public interface ISecretProtector
{
    /// <summary>
    /// Protects a value for storage.
    /// </summary>
    /// <param name="value">The plaintext value.</param>
    /// <returns>The protected value, safe to persist.</returns>
    Task<string> Protect(string value);
}

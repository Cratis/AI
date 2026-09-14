// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Abstractions;

/// <summary>
/// Reveals a secret a <see cref="ISecretProtector"/> previously protected, at the point the package is
/// about to use it - calling a vendor API, refreshing a subscription token. See <see cref="ISecretProtector"/>.
/// </summary>
public interface ISecretRevealer
{
    /// <summary>
    /// Reveals a protected value.
    /// </summary>
    /// <param name="value">The protected value.</param>
    /// <returns>The plaintext value.</returns>
    Task<string> Reveal(string value);
}

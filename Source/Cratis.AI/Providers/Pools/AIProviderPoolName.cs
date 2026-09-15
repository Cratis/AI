// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// The display name of an AI provider pool. Ported from Direct's
/// <c>AIProviders.Pools.AIProviderPoolName</c> (plan Section 5.2 step 5).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AIProviderPoolName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no name.
    /// </summary>
    public static readonly AIProviderPoolName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AIProviderPoolName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AIProviderPoolName(string value) => new(value);
}

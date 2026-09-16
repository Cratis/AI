// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools;

/// <summary>
/// The identity of an AI provider pool - a named group of providers an agent can draw from instead
/// of naming a single provider. Ported from Direct's <c>AIProviders.Pools.AIProviderPoolId</c>
/// (plan Section 5.2 step 5).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AIProviderPoolId(Guid Value) : EventSourceId<Guid>(Value)
{
    /// <summary>
    /// The value representing an unset pool identity.
    /// </summary>
    public static readonly AIProviderPoolId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="AIProviderPoolId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AIProviderPoolId(Guid value) => new(value);

    /// <summary>
    /// Creates a new unique pool identity.
    /// </summary>
    /// <returns>A new <see cref="AIProviderPoolId"/>.</returns>
    public static AIProviderPoolId New() => new(Guid.NewGuid());
}

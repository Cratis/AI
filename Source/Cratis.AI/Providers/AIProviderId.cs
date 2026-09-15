// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The identity of a configured AI provider - one per added provider, since a deployment can name as
/// many as it likes. Ported from Direct's <c>AIProviders.AIProviderId</c> (plan Section 5.2 step 1).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AIProviderId(Guid Value) : EventSourceId<Guid>(Value)
{
    /// <summary>
    /// The value representing an unset provider identity.
    /// </summary>
    public static readonly AIProviderId NotSet = new(Guid.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="Guid"/> to <see cref="AIProviderId"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AIProviderId(Guid value) => new(value);

    /// <summary>
    /// Creates a new unique provider identity.
    /// </summary>
    /// <returns>A new <see cref="AIProviderId"/>.</returns>
    public static AIProviderId New() => new(Guid.NewGuid());
}

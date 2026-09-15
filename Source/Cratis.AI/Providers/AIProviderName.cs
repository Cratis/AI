// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The display name of a configured AI provider - so people can tell several providers of the same
/// type apart (e.g. two Anthropic keys for different accounts). Ported from Direct's
/// <c>AIProviders.AIProviderName</c> (plan Section 5.2 step 1).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AIProviderName(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no name.
    /// </summary>
    public static readonly AIProviderName NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AIProviderName"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AIProviderName(string value) => new(value);
}

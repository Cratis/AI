// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// The base URL a configured AI provider is reached at - required for <see cref="AIProviderType.AzureOpenAI"/>
/// and <see cref="AIProviderType.OpenAICompatible"/>, meaningless for the others (Anthropic and OpenAI use
/// their fixed public API endpoints). Ported from Direct's <c>AIProviders.AIProviderEndpoint</c>
/// (plan Section 5.2 step 1).
/// </summary>
/// <param name="Value">The underlying value.</param>
public record AIProviderEndpoint(string Value) : ConceptAs<string>(Value)
{
    /// <summary>
    /// The value representing no endpoint.
    /// </summary>
    public static readonly AIProviderEndpoint NotSet = new(string.Empty);

    /// <summary>
    /// Implicitly convert from <see cref="string"/> to <see cref="AIProviderEndpoint"/>.
    /// </summary>
    /// <param name="value">The value to convert from.</param>
    public static implicit operator AIProviderEndpoint(string value) => new(value);
}

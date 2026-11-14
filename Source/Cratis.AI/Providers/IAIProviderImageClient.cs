// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers;

/// <summary>
/// A sibling of <see cref="IAIProviderClient"/> for vendor clients that can send images with a
/// completion. A client that implements it is still discovered as an <see cref="IAIProviderClient"/>;
/// the provider-aware language model checks for this interface before it sends images.
/// </summary>
public interface IAIProviderImageClient : IAIProviderClient
{
    /// <summary>
    /// Asks the provider to complete a prompt about one or more images.
    /// </summary>
    /// <param name="prompt">The prompt.</param>
    /// <param name="images">The images the prompt is about.</param>
    /// <param name="provider">The configured provider to call - its credentials and, for the vendors that need one, its endpoint.</param>
    /// <param name="model">The model to run the completion on.</param>
    /// <param name="effort">The reasoning effort to run the completion at.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    Task<LanguageModelResult> Complete(string prompt, IReadOnlyList<LanguageModelImage> images, ConfiguredAIProvider provider, ModelName model, Effort effort, CancellationToken cancellationToken = default);
}

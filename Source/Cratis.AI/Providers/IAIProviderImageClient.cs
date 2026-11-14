// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
    /// <param name="request">The prompt, images, provider, model and reasoning effort.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    Task<LanguageModelResult> Complete(ImageCompletionRequest request, CancellationToken cancellationToken = default);
}

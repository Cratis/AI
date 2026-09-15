// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers;

/// <summary>
/// A vendor-specific completion client for one <see cref="AIProviderType"/>, selected from the
/// provider a caller resolved to - one implementation per vendor, so adding a vendor needs no
/// change to any caller. Ported from Direct's <c>AIProviders.IAIProviderClient</c> (plan Section
/// 5.2 step 3).
/// </summary>
public interface IAIProviderClient
{
    /// <summary>
    /// Gets the vendor this client talks to.
    /// </summary>
    AIProviderType Type { get; }

    /// <summary>
    /// Asks the provider to complete a prompt.
    /// </summary>
    /// <param name="prompt">The prompt.</param>
    /// <param name="provider">The configured provider to call - its credentials and, for the vendors that need one, its endpoint.</param>
    /// <param name="model">The model to run the completion on.</param>
    /// <param name="effort">The reasoning effort to run the completion at - translated to whatever this vendor's API calls it.</param>
    /// <param name="cancellationToken">A <see cref="CancellationToken"/> for the operation.</param>
    /// <returns>The <see cref="LanguageModelResult"/>.</returns>
    Task<LanguageModelResult> Complete(string prompt, ConfiguredAIProvider provider, ModelName model, Effort effort, CancellationToken cancellationToken = default);
}

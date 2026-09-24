// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Common;
namespace Cratis.AI.Providers.AvailableModels;

/// <summary>
/// Defines a system that lists the models one <see cref="AIProviderType"/> currently serves - one
/// implementation per vendor, discovered by convention, mirroring Studio's
/// <c>ICanListAvailableModels</c>. Listing is best effort: the surface it feeds still lets a model
/// name be typed by hand, so an unreachable, unauthorized or unsupported provider yields nothing
/// rather than an error.
/// </summary>
public interface ICanListAvailableModels
{
    /// <summary>
    /// Gets the vendor this listing serves.
    /// </summary>
    AIProviderType Type { get; }

    /// <summary>
    /// Lists the models the provider currently serves.
    /// </summary>
    /// <param name="provider">The configured provider to ask - its credentials already revealed.</param>
    /// <returns>The model names the provider publishes - empty when it publishes none or cannot be asked.</returns>
    Task<IEnumerable<ModelName>> List(ConfiguredAIProvider provider);
}

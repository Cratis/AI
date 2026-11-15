// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers;

/// <summary>
/// A completion about one or more images, as handed to an <see cref="IAIProviderImageClient"/>.
/// </summary>
/// <param name="Prompt">The prompt.</param>
/// <param name="Images">The images the prompt is about.</param>
/// <param name="Provider">The configured provider to call - its credentials and, for the vendors that need one, its endpoint.</param>
/// <param name="Model">The model to run the completion on.</param>
/// <param name="Effort">The reasoning effort to run the completion at.</param>
public record ImageCompletionRequest(string Prompt, IReadOnlyList<LanguageModelImage> Images, ConfiguredAIProvider Provider, ModelName Model, Effort Effort);

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.LanguageModels;

/// <summary>
/// The usage a single completion reported, when the provider reports it - the shape
/// <see cref="LanguageModelResult"/> carries so "the API returns a result for every operation, which
/// includes usage" (plan Section 5.3e) is true of every completion, not only harness sessions.
/// </summary>
/// <param name="InputTokens">Tokens the prompt consumed.</param>
/// <param name="OutputTokens">Tokens the completion produced.</param>
/// <param name="CachedTokens">Prompt tokens served from the provider's own cache.</param>
/// <param name="CostUsd">The reported cost, in USD.</param>
/// <param name="Duration">How long the completion took.</param>
public record LanguageModelUsage(
    InputTokens InputTokens,
    OutputTokens OutputTokens,
    CachedTokens? CachedTokens = null,
    CostUsd? CostUsd = null,
    DurationMilliseconds? Duration = null);

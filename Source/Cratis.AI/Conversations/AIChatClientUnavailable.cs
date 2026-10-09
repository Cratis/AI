// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;

namespace Cratis.AI.Conversations;

/// <summary>
/// The exception thrown when nothing the agent behind a purpose names could serve a chat call - a missing
/// or removed provider or pool, saturated or rate-limited members, or a failure no member could fix.
/// </summary>
/// <param name="purpose">The purpose whose agent could not be served.</param>
/// <param name="reason">Why nothing could serve it.</param>
public class AIChatClientUnavailable(LanguageModelPurpose purpose, string reason)
    : InvalidOperationException($"No AI provider could serve the {purpose.Value} agent: {reason}")
{
    /// <summary>
    /// Gets the purpose that could not be served.
    /// </summary>
    public LanguageModelPurpose Purpose { get; } = purpose;
}

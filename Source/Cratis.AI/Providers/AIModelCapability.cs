// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// A behavior exposed by an individual language model. Ported from Direct's
/// <c>AIProviders.AIModelCapability</c> (plan Section 5.2 step 2).
/// </summary>
public enum AIModelCapability
{
    /// <summary>
    /// The model can participate in a conversational completion.
    /// </summary>
    Conversational = 0,

    /// <summary>
    /// The model supports extended reasoning.
    /// </summary>
    Reasoning = 1,

    /// <summary>
    /// The model can call tools.
    /// </summary>
    ToolUse = 2,

    /// <summary>
    /// The model accepts image input.
    /// </summary>
    Vision = 3,

    /// <summary>
    /// The model can score a bounded set of choices and return a probability distribution over them.
    /// </summary>
    Decision = 4,
}

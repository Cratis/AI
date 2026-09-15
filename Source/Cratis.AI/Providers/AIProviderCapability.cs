// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// A way an AI provider can be used. Ported from Direct's <c>AIProviders.AIProviderCapability</c>
/// (plan Section 5.2 step 2).
/// </summary>
public enum AIProviderCapability
{
    /// <summary>
    /// The provider can answer an in-process chat completion.
    /// </summary>
    Conversational = 0,

    /// <summary>
    /// The provider can drive work delegated to an agent harness.
    /// </summary>
    Agentic = 1,
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// Which vendor a configured AI provider talks to. Ported from Direct's
/// <c>AIProviders.AIProviderType</c> (plan Section 5.2 step 1) - already the superset the plan
/// asks the package to own (Section 1's scope table).
/// </summary>
public enum AIProviderType
{
    /// <summary>
    /// Anthropic's Messages API.
    /// </summary>
    Anthropic = 0,

    /// <summary>
    /// OpenAI's public API.
    /// </summary>
    OpenAI = 1,

    /// <summary>
    /// An Azure OpenAI deployment, reached at a tenant-specific endpoint.
    /// </summary>
    AzureOpenAI = 2,

    /// <summary>
    /// A self-hosted or third-party endpoint that speaks OpenAI's chat-completions API shape
    /// (Ollama, LocalAI, and similar) - one type covers every such gateway rather than
    /// distinguishing each by name the way Studio's separate legacy <c>LocalAI</c> singleton did.
    /// </summary>
    OpenAICompatible = 3,

    /// <summary>
    /// Z.ai's GLM API - an Anthropic-compatible endpoint that both harnesses reach natively: the
    /// Claude CLI through its Anthropic surface and Pi through its own Z.ai provider. The endpoint
    /// is configured per provider, defaulting to Z.ai's public one.
    /// </summary>
    ZAI = 4,

    /// <summary>
    /// OpenAI Codex through a user's ChatGPT subscription. This is an agent-harness provider and
    /// does not expose the public OpenAI API's conversational completion surface.
    /// </summary>
    OpenAICodex = 5,
}

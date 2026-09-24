// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.Anthropic;

/// <summary>
/// Runs a tool-free completion through Claude Code's subscription-authenticated SDK mode.
/// </summary>
public interface IClaudeCodeCompletion
{
    /// <summary>
    /// Completes a prompt using the configured subscription credential, without a repository or tools.
    /// </summary>
    /// <param name="prompt">The content to analyze.</param>
    /// <param name="credential">The revealed subscription token, passed only through the child environment.</param>
    /// <param name="model">The configured model.</param>
    /// <param name="effort">The requested reasoning effort.</param>
    /// <param name="cancellationToken">Cancels queued or executing work.</param>
    /// <returns>The completion or an explicit failure.</returns>
    Task<LanguageModelResult> Complete(string prompt, AIProviderApiKey credential, ModelName model, Effort effort, CancellationToken cancellationToken);
}

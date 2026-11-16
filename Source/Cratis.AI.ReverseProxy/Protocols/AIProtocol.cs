// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.ReverseProxy.Protocols;

/// <summary>
/// The wire protocols a model can be reached over. An endpoint can speak more than one - Ollama and LM Studio answer
/// both on the same address.
/// </summary>
[Flags]
public enum AIProtocol
{
    /// <summary>
    /// No protocol.
    /// </summary>
    None = 0,

    /// <summary>
    /// OpenAI's API: <c>/v1/chat/completions</c> and its relatives, with <c>Authorization: Bearer</c>.
    /// </summary>
    OpenAI = 1,

    /// <summary>
    /// Anthropic's (Claude's) Messages API: <c>/v1/messages</c>, with <c>x-api-key</c> and <c>anthropic-version</c>.
    /// </summary>
    Anthropic = 2,
}

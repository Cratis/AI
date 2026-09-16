// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Harnesses;

/// <summary>
/// The CLI harness an agent session runs under when it is a job invocation, driving a coding agent
/// inside a worker container - as opposed to a chat/conversation invocation, which talks to its AI
/// provider directly and touches no harness. Ported from Direct's <c>Agents.Harness</c> (plan Section 5.6).
/// </summary>
public enum Harness
{
    /// <summary>
    /// The Claude Code CLI (<c>@anthropic-ai/claude-code</c>). Requires the session's resolved AI
    /// provider to be an Anthropic one, whose key travels as <c>ANTHROPIC_API_KEY</c>.
    /// </summary>
    Claude = 0,

    /// <summary>
    /// The Pi coding agent CLI (<c>@earendil-works/pi-coding-agent</c>), driven over its
    /// <c>--mode rpc</c> newline-delimited JSON protocol - see <c>Source/AgentHarnesses/entrypoint.sh</c>.
    /// Its vendor reach (Anthropic, OpenAI, Azure OpenAI, an OpenAI-compatible gateway) is broader
    /// than Claude Code's Anthropic-only support.
    /// </summary>
    Pi = 1,
}

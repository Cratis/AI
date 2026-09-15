// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Agents;

/// <summary>
/// The two ways an agent is invoked - stated in the domain rather than left implicit in the code
/// paths. Ported from Direct's <c>Agents.AgentInvocationMode</c> (plan Section 5.5).
/// </summary>
public enum AgentInvocationMode
{
    /// <summary>
    /// A direct, awaitable completion: the caller hands the agent a prompt and waits for its answer
    /// in-process. This is the path a resolution layer built on <c>ILanguageModel</c> serves, and
    /// what every backend reasoning job (triage, classification, summarization, chat) goes through.
    /// </summary>
    Chat = 0,

    /// <summary>
    /// A unit of work in a worker container: the dispatcher launches the agent's configured harness
    /// in the harness's worker image, resolves the agent's provider or pool to an API key revealed
    /// at dispatch, and the container reports back through a callback. This is the worker dispatch
    /// path (plan Section 5.6) - investigations, implementations, reviews, and ad-hoc jobs.
    /// </summary>
    Job = 1,
}

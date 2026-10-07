// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;
using Microsoft.Extensions.AI;

namespace Cratis.AI.Conversations;

/// <summary>
/// Defines a system that hands out <see cref="IChatClient"/>s for an agent or purpose, resolved through
/// the same provider-pool dispatch, concurrency limit, rate-limit cooldown and usage recording as
/// <see cref="ILanguageModel"/>.
/// </summary>
/// <remarks>
/// Multi-turn, streaming and tool calls are supported: wrap the returned client with
/// <c>UseFunctionInvocation()</c> and every model call of the tool loop is dispatched on its own, so a
/// long conversation spreads across the pool and a member that gets rate limited stops being picked.
/// </remarks>
public interface IAIChatClients
{
    /// <summary>
    /// Gets a chat client for the agent that serves a purpose.
    /// </summary>
    /// <param name="purpose">The purpose - the agent's identity - the client talks as.</param>
    /// <returns>A chat client whose provider is resolved from the agent, per call.</returns>
    IChatClient For(LanguageModelPurpose purpose);
}

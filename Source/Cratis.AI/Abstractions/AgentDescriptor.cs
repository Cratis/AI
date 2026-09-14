// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Abstractions;

/// <summary>
/// The minimal, product-neutral shape of an agent that <see cref="IAgentExecution"/> needs to attribute
/// events to one - a subset of whatever richer agent model a consumer keeps.
/// </summary>
/// <param name="Id">The agent's <see cref="AgentId"/>.</param>
/// <param name="Name">The agent's display <see cref="AgentName"/>.</param>
public record AgentDescriptor(AgentId Id, AgentName Name);

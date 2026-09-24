// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents.Configuring;
using Cratis.Chronicle;
using Cratis.Chronicle.Reactors;
namespace Cratis.AI.Agents.Naming;

/// <summary>
/// Keeps the display name of an agent's Chronicle identity in step with the name it is configured
/// with, so the event log names an agent the way the Settings page does.
/// </summary>
/// <remarks>
/// A name is a display value Chronicle resolves from the identity itself rather than storing on each
/// event that refers to it - which is exactly why a rename has to be pushed there rather than
/// re-stamped on events already appended. Renaming makes every event an agent has ever caused read
/// under the new name, past ones included, which is the behavior wanted here: it is the same agent.
/// </remarks>
/// <param name="eventStore">The <see cref="IEventStore"/> whose identities are renamed.</param>
public class AgentIdentityNaming(IEventStore eventStore) : IReactor
{
    /// <summary>
    /// Renames the agent's Chronicle identity to whatever it was just configured with.
    /// </summary>
    /// <param name="event">The <see cref="AgentConfigured"/> event.</param>
    /// <returns>Awaitable task.</returns>
    public Task On(AgentConfigured @event) =>
        eventStore.Identities.Rename(AgentId.For(@event.Purpose).Value, @event.Name.Value);
}

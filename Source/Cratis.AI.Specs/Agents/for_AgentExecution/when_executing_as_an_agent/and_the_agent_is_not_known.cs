// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.Chronicle.Identities;
using NSubstitute;
using ChronicleIdentity = Cratis.Chronicle.Identities.Identity;
using ChronicleIdentityProvider = Cratis.Chronicle.Identities.IIdentityProvider;

namespace Cratis.AI.Agents.for_AgentExecution.when_executing_as_an_agent;

/// <summary>
/// An agent id nothing recognizes must never block the work it is trying to attribute - the scope
/// becomes a no-op rather than throwing, and the work still runs unattributed as the system.
/// </summary>
public class and_the_agent_is_not_known : given.an_execution
{
    static readonly AgentId _unknownAgentId = new("no-such-agent");

    ChronicleIdentity _identityDuring;

    void Establish() => Agents.Find(_unknownAgentId).Returns((AgentDescriptor?)null);

    void Because()
    {
        using var scope = AgentExecution.As(_unknownAgentId);
        _identityDuring = ((ChronicleIdentityProvider)new BaseIdentityProvider()).GetCurrent();
    }

    [Fact] void should_not_attribute_events_to_the_unknown_agent() => _identityDuring.ShouldEqual(ChronicleIdentity.System);
}

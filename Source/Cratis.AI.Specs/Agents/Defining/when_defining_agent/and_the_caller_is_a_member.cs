// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Security.Claims;

namespace Cratis.AI.Agents.Defining.when_defining_agent;

public class and_the_caller_is_a_member : given.a_restricted_caller
{
    void Establish() => _principal = new(new ClaimsIdentity([new Claim(ClaimTypes.Role, "Member")], "test"));
    Task Because() => Execute();

    [Fact] void should_deny_access() => _result.ShouldNotBeAuthorized();
    [Fact] void should_append_nothing() => _scenario.AppendedEvents.ShouldBeEmpty();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;

namespace Cratis.AI.Agents.for_WorkInitiation;

public class when_parallel_work_runs : Specification
{
    readonly WorkInitiation _initiation = new();
    TeamMemberId[] _results;

    async Task Because() => _results = await Task.WhenAll(ReadInside("alice"), ReadInside("bob"));

    [Fact] void should_isolate_async_flows() => _results.ShouldContainOnly((TeamMemberId)"alice", (TeamMemberId)"bob");
    [Fact] void should_not_leak_an_initiator_to_the_caller() => _initiation.Current.ShouldEqual(WorkInitiator.None);

    async Task<TeamMemberId> ReadInside(TeamMemberId member)
    {
        using var scope = _initiation.Begin(WorkInitiator.By(member));
        await Task.Yield();
        return _initiation.Current.Member!;
    }
}

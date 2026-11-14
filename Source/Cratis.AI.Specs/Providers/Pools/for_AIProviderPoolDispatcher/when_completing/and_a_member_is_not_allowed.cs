// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.when_completing;

public class and_a_member_is_not_allowed : given.a_dispatcher_with_member_access
{
    async Task Because()
    {
        using var scope = _initiation.Begin(WorkInitiator.By((TeamMemberId)"bob"));
        _result = await Dispatch();
    }

    [Fact] void should_serve_the_allowed_member() => _result.Text.ShouldEqual("allowed");
    [Fact] void should_not_call_the_excluded_member() => _restrictedClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, default);
}

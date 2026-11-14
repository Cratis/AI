// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_AIProviderPoolDispatcher.when_completing;

public class and_no_member_is_allowed : given.a_dispatcher_with_member_access
{
    void Establish() => _pool = _pool with { Members = [new(_restrictedId)] };

    async Task Because() => _result = await Dispatch();

    [Fact] void should_fail_closed() => _result.Succeeded.ShouldBeFalse();
    [Fact] void should_not_retry() => _result.IsTransient.ShouldBeFalse();
    [Fact] void should_explain_access() => _result.FailureReason.ShouldContain("work initiator");
    [Fact] void should_not_call_the_vendor() => _restrictedClient.DidNotReceiveWithAnyArgs().Complete(default!, default!, default!, default, default);
}

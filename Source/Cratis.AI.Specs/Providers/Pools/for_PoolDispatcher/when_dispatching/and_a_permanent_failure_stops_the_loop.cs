// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

/// <summary>
/// A permanent failure - a rejected request, bad credentials - is not worth trying the rest of the
/// pool for: no other member can fix what is wrong with the request itself (issue #1060).
/// </summary>
public class and_a_permanent_failure_stops_the_loop : given.all_dependencies
{
    PoolDispatchResult<string> _result;

    async Task Because() => _result = await PoolDispatcher.Dispatch(
        [_firstMember, _secondMember],
        _selection,
        _failureMemory,
        "exhausted",
        (member, _) =>
        {
            _tried.Add(member.ProviderId);
            return Task.FromResult(PoolAttempt<string>.PermanentFailure("rejected", "The request was rejected"));
        });

    [Fact] void should_stop() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Stopped);
    [Fact] void should_carry_the_failed_value() => _result.Value.ShouldEqual("rejected");
    [Fact] void should_carry_the_reason() => _result.Reason.ShouldEqual("The request was rejected");
    [Fact] void should_have_tried_only_the_first_member() => _tried.ShouldContainOnly(_first);
    [Fact] void should_not_have_recorded_a_failure() => _failureMemory.DidNotReceive().Record(Arg.Any<AIProviderId>());
}

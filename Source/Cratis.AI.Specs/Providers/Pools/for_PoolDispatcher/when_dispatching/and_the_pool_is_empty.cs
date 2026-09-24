// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

public class and_the_pool_is_empty : given.all_dependencies
{
    PoolDispatchResult<string> _result;

    async Task Because() => _result = await PoolDispatcher.Dispatch(
        [],
        _selection,
        _failureMemory,
        "the pool has no members",
        (member, _) =>
        {
            _tried.Add(member.ProviderId);
            return Task.FromResult(PoolAttempt<string>.Succeeded("never happens"));
        });

    [Fact] void should_be_exhausted() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Exhausted);
    [Fact] void should_carry_the_reason_it_was_handed() => _result.Reason.ShouldEqual("the pool has no members");
    [Fact] void should_not_flag_any_transient_failure() => _result.AnyTransientFailure.ShouldBeFalse();
    [Fact] void should_never_have_tried_a_member() => _tried.ShouldBeEmpty();
}

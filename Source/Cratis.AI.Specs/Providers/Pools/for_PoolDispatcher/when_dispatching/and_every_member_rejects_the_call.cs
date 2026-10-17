// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

/// <summary>
/// When every member rejects the call, retrying later cannot help: the first rejection is the answer.
/// </summary>
public class and_every_member_rejects_the_call : given.all_dependencies
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
            return Task.FromResult(PoolAttempt<string>.PermanentFailure("rejected-" + member.ProviderId.Value, "rejected by " + member.ProviderId.Value));
        });

    [Fact] void should_stop() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Stopped);
    [Fact] void should_have_tried_both_members() => _tried.Count.ShouldEqual(2);
    [Fact] void should_carry_the_first_rejection() => _result.Reason.ShouldEqual("rejected by " + _tried[0].Value);
    [Fact] void should_not_be_worth_retrying() => _result.AnyTransientFailure.ShouldBeFalse();
}

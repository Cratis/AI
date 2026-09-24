// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

/// <summary>
/// A transient failure on one member is recorded against it and the loop moves to the next member,
/// rather than sinking the whole dispatch on a vendor blip (issue #1060).
/// </summary>
public class and_a_transient_failure_is_followed_by_success : given.all_dependencies
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
            return Task.FromResult(member.ProviderId == _first
                ? PoolAttempt<string>.TransientFailure("429")
                : PoolAttempt<string>.Succeeded("served-by-second"));
        });

    [Fact] void should_succeed() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Succeeded);
    [Fact] void should_return_what_the_surviving_member_produced() => _result.Value.ShouldEqual("served-by-second");
    [Fact] void should_have_tried_both_members() => _tried.ShouldContainOnly(_first, _second);
    [Fact] void should_have_recorded_the_transient_failure_against_the_first_member() => _failureMemory.Received(1).Record(_first);
    [Fact] void should_not_have_recorded_anything_against_the_second_member() => _failureMemory.DidNotReceive().Record(_second);
}

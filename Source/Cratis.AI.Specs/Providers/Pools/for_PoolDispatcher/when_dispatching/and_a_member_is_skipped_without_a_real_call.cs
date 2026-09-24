// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

/// <summary>
/// A member that was never actually tried with a real call - unconfigured, incompatible,
/// rate-limited - is not worth remembering as a failure: nothing about the provider's own health was
/// learned.
/// </summary>
public class and_a_member_is_skipped_without_a_real_call : given.all_dependencies
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
                ? PoolAttempt<string>.Skipped("not configured")
                : PoolAttempt<string>.Succeeded("served-by-second"));
        });

    [Fact] void should_succeed() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Succeeded);
    [Fact] void should_have_tried_both_members() => _tried.ShouldContainOnly(_first, _second);
    [Fact] void should_not_have_recorded_a_failure_for_the_skipped_member() => _failureMemory.DidNotReceive().Record(Arg.Any<AIProviderId>());
}

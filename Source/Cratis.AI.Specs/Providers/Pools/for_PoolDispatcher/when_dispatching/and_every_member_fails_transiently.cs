// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

/// <summary>
/// A pool exhausted purely by transient failures is worth a whole new attempt later - nothing said
/// the request itself was wrong (issue #1060, #882's result-type requirement one layer up).
/// </summary>
public class and_every_member_fails_transiently : given.all_dependencies
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
            return Task.FromResult(PoolAttempt<string>.TransientFailure("503"));
        });

    [Fact] void should_be_exhausted() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Exhausted);
    [Fact] void should_report_no_value() => _result.Value.ShouldBeNull();
    [Fact] void should_flag_that_a_transient_failure_occurred() => _result.AnyTransientFailure.ShouldBeTrue();
    [Fact] void should_have_tried_both_members() => _tried.ShouldContainOnly(_first, _second);
    [Fact] void should_have_recorded_a_failure_for_both_members() => _failureMemory.Received(1).Record(_first);
}

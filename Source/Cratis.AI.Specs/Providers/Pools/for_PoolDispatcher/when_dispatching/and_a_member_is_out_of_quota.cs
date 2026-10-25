// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

/// <summary>
/// A member whose quota is spent is remembered against it and the loop moves on to the next member,
/// which serves the request (Cratis/AI#423).
/// </summary>
public class and_a_member_is_out_of_quota : given.all_dependencies
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
                ? PoolAttempt<string>.QuotaExhausted("enforced_spend_limit_reached")
                : PoolAttempt<string>.Succeeded("served-by-second"));
        });

    [Fact] void should_succeed() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Succeeded);
    [Fact] void should_return_what_the_next_member_produced() => _result.Value.ShouldEqual("served-by-second");
    [Fact] void should_have_tried_both_members_in_order() => _tried.ShouldContainOnly(_first, _second);
    [Fact] void should_remember_the_failure_against_the_member_out_of_quota() => _failureMemory.Received(1).Record(_first);
    [Fact] void should_name_the_member_out_of_quota() => _result.QuotaExhaustedProviders.ShouldContainOnly(_first);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

/// <summary>
/// A rejection - bad credentials, a retired model, an account with no credit - is as likely to be about
/// the provider as about the request, so the pool moves on to its next member instead of failing the call.
/// </summary>
public class and_a_member_rejects_the_call_and_the_next_serves_it : given.all_dependencies
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
                ? PoolAttempt<string>.PermanentFailure("rejected", "The request was rejected")
                : PoolAttempt<string>.Succeeded("served-by-second"));
        });

    [Fact] void should_succeed() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Succeeded);
    [Fact] void should_return_what_the_other_member_produced() => _result.Value.ShouldEqual("served-by-second");
    [Fact] void should_have_tried_both_members() => _tried.ShouldContainOnly(_first, _second);
    [Fact] void should_remember_the_rejecting_member_as_failing() => _failureMemory.Received(1).Record(_first);
}

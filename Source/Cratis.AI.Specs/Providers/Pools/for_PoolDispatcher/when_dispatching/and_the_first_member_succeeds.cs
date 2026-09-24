// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

public class and_the_first_member_succeeds : given.all_dependencies
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
            return Task.FromResult(PoolAttempt<string>.Succeeded("served"));
        });

    [Fact] void should_succeed() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Succeeded);
    [Fact] void should_return_what_the_member_produced() => _result.Value.ShouldEqual("served");
    [Fact] void should_have_tried_only_the_first_member() => _tried.ShouldContainOnly(_first);
    [Fact] void should_not_have_recorded_any_failure() => _failureMemory.DidNotReceive().Record(Arg.Any<AIProviderId>());
}

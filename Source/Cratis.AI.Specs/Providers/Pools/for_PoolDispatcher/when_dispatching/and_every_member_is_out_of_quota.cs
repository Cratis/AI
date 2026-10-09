// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolDispatcher.when_dispatching;

/// <summary>
/// A pool whose every member is out of quota is exhausted with a reason that says so and names every
/// provider tried - and, since a spent quota does not come back within seconds, it is not flagged as
/// worth an immediate retry (Cratis/AI#423).
/// </summary>
public class and_every_member_is_out_of_quota : given.all_dependencies
{
    PoolDispatchResult<string> _result;

    async Task Because() => _result = await PoolDispatcher.Dispatch(
        [_firstMember, _secondMember],
        _selection,
        _failureMemory,
        "No member could serve this",
        (member, _) =>
        {
            _tried.Add(member.ProviderId);
            return Task.FromResult(PoolAttempt<string>.QuotaExhausted("insufficient_quota"));
        });

    [Fact] void should_be_exhausted() => _result.Outcome.ShouldEqual(PoolDispatchOutcome.Exhausted);
    [Fact] void should_not_flag_a_transient_failure() => _result.AnyTransientFailure.ShouldBeFalse();
    [Fact] void should_say_the_pool_is_exhausted() => _result.Reason.ShouldContain("the pool is exhausted");
    [Fact] void should_name_the_first_provider_tried() => _result.Reason.ShouldContain(_first.ToString());
    [Fact] void should_name_the_second_provider_tried() => _result.Reason.ShouldContain(_second.ToString());
    [Fact] void should_carry_the_last_failure() => _result.Reason.ShouldContain("insufficient_quota");
    [Fact] void should_report_both_providers_as_tried() => _result.TriedProviders.ShouldContainOnly(_first, _second);
    [Fact] void should_report_both_providers_as_out_of_quota() => _result.QuotaExhaustedProviders.ShouldContainOnly(_first, _second);
}

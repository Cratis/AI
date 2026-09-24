// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.Pools.for_PoolMemberSelector;

public class when_selecting : Specification
{
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();
    static readonly AIProviderId _third = AIProviderId.New();

    static readonly AIProviderPoolMember _firstMember = new(_first);
    static readonly AIProviderPoolMember _secondMember = new(_second);
    static readonly AIProviderPoolMember _thirdMember = new(_third);

    static PoolSelectionData Burn(
        Dictionary<AIProviderId, long>? tokens = null,
        Dictionary<AIProviderId, int>? sessions = null,
        Dictionary<AIProviderId, int>? failures = null,
        Dictionary<AIProviderId, long>? capacity = null) =>
        new(
            tokens ?? new Dictionary<AIProviderId, long>(),
            sessions ?? new Dictionary<AIProviderId, int>(),
            failures ?? new Dictionary<AIProviderId, int>(),
            capacity ?? new Dictionary<AIProviderId, long>());

    [Fact]
    void should_return_null_for_an_empty_pool() =>
        PoolMemberSelector.Select([], Burn()).ShouldBeNull();

    [Fact]
    void should_return_the_single_member_of_a_one_member_pool() =>
        PoolMemberSelector.Select([_firstMember], Burn()).ShouldEqual(_firstMember);

    [Fact]
    void should_pick_the_member_with_the_least_tokens_burnt() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember, _thirdMember],
            Burn(
                tokens: new() { [_first] = 5000, [_second] = 100, [_third] = 900 },
                sessions: new() { [_first] = 5, [_second] = 5, [_third] = 5 })).ShouldEqual(_secondMember);

    [Fact]
    void should_treat_a_member_with_no_recorded_usage_as_most_available() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember, _thirdMember],
            Burn(
                tokens: new() { [_first] = 1, [_second] = 1 },
                sessions: new() { [_first] = 1, [_second] = 1 })).ShouldEqual(_thirdMember);

    [Fact]
    void should_break_a_token_tie_by_fewest_recent_sessions() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Burn(
                tokens: new() { [_first] = 500, [_second] = 500 },
                sessions: new() { [_first] = 9, [_second] = 2 })).ShouldEqual(_secondMember);

    [Fact]
    void should_break_a_full_tie_by_declaration_order() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Burn(
                tokens: new() { [_first] = 500, [_second] = 500 },
                sessions: new() { [_first] = 3, [_second] = 3 })).ShouldEqual(_firstMember);

    [Fact]
    void should_rank_a_member_that_recently_failed_behind_a_heavier_burnt_one() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Burn(
                tokens: new() { [_first] = 1, [_second] = 9999 },
                failures: new() { [_first] = 1 })).ShouldEqual(_secondMember);

    [Fact]
    void should_rank_a_member_whose_capacity_is_exhausted_last() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Burn(
                tokens: new() { [_first] = 1, [_second] = 9999 },
                capacity: new() { [_first] = 0 })).ShouldEqual(_secondMember);

    [Fact]
    void should_prefer_a_member_with_measured_remaining_capacity_over_one_with_none_known() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Burn(
                tokens: new() { [_first] = 9999, [_second] = 1 },
                capacity: new() { [_first] = 500_000 })).ShouldEqual(_firstMember);

    [Fact]
    void should_prefer_the_member_with_the_most_remaining_capacity() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Burn(capacity: new() { [_first] = 10, [_second] = 1_000 })).ShouldEqual(_secondMember);
}

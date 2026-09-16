// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolMemberSelector;

public class when_selecting : Specification
{
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();
    static readonly AIProviderId _third = AIProviderId.New();

    static readonly AIProviderPoolMember _firstMember = new(_first);
    static readonly AIProviderPoolMember _secondMember = new(_second);
    static readonly AIProviderPoolMember _thirdMember = new(_third);

    [Fact]
    void should_return_null_for_an_empty_pool() =>
        PoolMemberSelector.Select([], new Dictionary<AIProviderId, long>(), new Dictionary<AIProviderId, int>()).ShouldBeNull();

    [Fact]
    void should_return_the_single_member_of_a_one_member_pool() =>
        PoolMemberSelector.Select([_firstMember], new Dictionary<AIProviderId, long>(), new Dictionary<AIProviderId, int>()).ShouldEqual(_firstMember);

    [Fact]
    void should_pick_the_member_with_the_least_tokens_burnt() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember, _thirdMember],
            new Dictionary<AIProviderId, long> { [_first] = 5000, [_second] = 100, [_third] = 900 },
            new Dictionary<AIProviderId, int> { [_first] = 5, [_second] = 5, [_third] = 5 }).ShouldEqual(_secondMember);

    [Fact]
    void should_treat_a_member_with_no_recorded_usage_as_most_available() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember, _thirdMember],
            new Dictionary<AIProviderId, long> { [_first] = 1, [_second] = 1 },
            new Dictionary<AIProviderId, int> { [_first] = 1, [_second] = 1 }).ShouldEqual(_thirdMember);

    [Fact]
    void should_break_a_token_tie_by_fewest_recent_sessions() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            new Dictionary<AIProviderId, long> { [_first] = 500, [_second] = 500 },
            new Dictionary<AIProviderId, int> { [_first] = 9, [_second] = 2 }).ShouldEqual(_secondMember);

    [Fact]
    void should_break_a_full_tie_by_declaration_order() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            new Dictionary<AIProviderId, long> { [_first] = 500, [_second] = 500 },
            new Dictionary<AIProviderId, int> { [_first] = 3, [_second] = 3 }).ShouldEqual(_firstMember);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Pools.for_PoolMemberSelector;

/// <summary>
/// <see cref="PoolMemberSelector.Candidates"/> is what <see cref="AIProviderPoolDispatcher"/> walks
/// to fail over past a member that just answered transiently (Cratis/AI#337) - this asserts it
/// returns every member, in the same order <see cref="PoolMemberSelector.Select"/>'s single pick
/// comes from the head of.
/// </summary>
public class when_getting_candidates : Specification
{
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();
    static readonly AIProviderId _third = AIProviderId.New();

    static readonly AIProviderPoolMember _firstMember = new(_first);
    static readonly AIProviderPoolMember _secondMember = new(_second);
    static readonly AIProviderPoolMember _thirdMember = new(_third);

    [Fact]
    void should_return_every_member_for_an_empty_burn_history() =>
        PoolMemberSelector.Candidates(
            [_firstMember, _secondMember, _thirdMember],
            new Dictionary<AIProviderId, long>(),
            new Dictionary<AIProviderId, int>())
            .Count()
            .ShouldEqual(3);

    [Fact]
    void should_order_least_burnt_first()
    {
        var candidates = PoolMemberSelector.Candidates(
            [_firstMember, _secondMember, _thirdMember],
            new Dictionary<AIProviderId, long> { [_first] = 5000, [_second] = 100, [_third] = 900 },
            new Dictionary<AIProviderId, int> { [_first] = 5, [_second] = 5, [_third] = 5 }).ToList();

        candidates[0].ShouldEqual(_secondMember);
        candidates[1].ShouldEqual(_thirdMember);
        candidates[2].ShouldEqual(_firstMember);
    }

    [Fact]
    void should_have_its_head_match_select() =>
        PoolMemberSelector.Candidates(
            [_firstMember, _secondMember, _thirdMember],
            new Dictionary<AIProviderId, long> { [_first] = 5000, [_second] = 100, [_third] = 900 },
            new Dictionary<AIProviderId, int> { [_first] = 5, [_second] = 5, [_third] = 5 })
            .First()
            .ShouldEqual(PoolMemberSelector.Select(
                [_firstMember, _secondMember, _thirdMember],
                new Dictionary<AIProviderId, long> { [_first] = 5000, [_second] = 100, [_third] = 900 },
                new Dictionary<AIProviderId, int> { [_first] = 5, [_second] = 5, [_third] = 5 }));
}

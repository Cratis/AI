// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Pools.Listing;

namespace Cratis.AI.Providers.Pools.for_PoolMemberSelector;

/// <summary>
/// The headroom a vendor reports outranks local burn: a subscription about to run out of its weekly
/// window is a worse pick than one with most of it left, however little it has burnt. Not knowing
/// counts as full, so an unmeasured member is never ranked behind one known to be nearly spent.
/// </summary>
public class when_ranking_by_headroom : Specification
{
    static readonly AIProviderId _first = AIProviderId.New();
    static readonly AIProviderId _second = AIProviderId.New();
    static readonly AIProviderId _third = AIProviderId.New();

    static readonly AIProviderPoolMember _firstMember = new(_first);
    static readonly AIProviderPoolMember _secondMember = new(_second);
    static readonly AIProviderPoolMember _thirdMember = new(_third);

    static PoolSelectionData Selection(
        Dictionary<AIProviderId, double> headroom,
        Dictionary<AIProviderId, long>? tokens = null,
        Dictionary<AIProviderId, int>? failures = null,
        Dictionary<AIProviderId, long>? capacity = null) =>
        new(
            tokens ?? new Dictionary<AIProviderId, long>(),
            new Dictionary<AIProviderId, int>(),
            failures ?? new Dictionary<AIProviderId, int>(),
            capacity ?? new Dictionary<AIProviderId, long>())
        {
            HeadroomByProvider = headroom
        };

    [Fact]
    void should_rank_the_most_headroom_first() =>
        PoolMemberSelector.Candidates(
            [_firstMember, _secondMember, _thirdMember],
            Selection(new() { [_first] = 0.1, [_second] = 0.9, [_third] = 0.5 })).SequenceEqual([_secondMember, _thirdMember, _firstMember]).ShouldBeTrue();

    [Fact]
    void should_rank_by_headroom_ahead_of_burn() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Selection(new() { [_first] = 0.2, [_second] = 0.8 }, tokens: new() { [_first] = 1, [_second] = 99999 })).ShouldEqual(_secondMember);

    [Fact]
    void should_count_an_unknown_headroom_as_full() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Selection(new() { [_first] = 0.7 })).ShouldEqual(_secondMember);

    [Fact]
    void should_rank_a_member_with_no_headroom_after_every_member_with_some() =>
        PoolMemberSelector.Candidates(
            [_firstMember, _secondMember],
            Selection(new() { [_first] = 0, [_second] = 0.01 })).First().ShouldEqual(_secondMember);

    [Fact]
    void should_rank_a_member_that_recently_failed_after_one_with_no_headroom() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Selection(new() { [_first] = 0.9, [_second] = 0 }, failures: new() { [_first] = 1 })).ShouldEqual(_secondMember);

    [Fact]
    void should_fall_back_to_remaining_capacity_between_equal_headroom() =>
        PoolMemberSelector.Select(
            [_firstMember, _secondMember],
            Selection(new() { [_first] = 0.5, [_second] = 0.5 }, capacity: new() { [_first] = 100, [_second] = 900 })).ShouldEqual(_secondMember);
}

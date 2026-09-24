// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.UsageReporting;
using PackageAIProviderId = Cratis.AI.Providers.AIProviderId;

namespace Cratis.AI.Providers.UsageReporting.for_ProviderUsageLevels.when_refreshing_many;

/// <summary>
/// Refreshing a whole pool must not fail outright just because one member's vendor report could not
/// be reached - every other member still gets a usable level, and the unreachable one degrades
/// rather than blocking selection (issue #1061).
/// </summary>
public class and_one_provider_is_unreachable_among_several : given.all_dependencies
{
    static readonly AIProviderId _healthy = AIProviderId.New();
    static readonly AIProviderId _unreachable = AIProviderId.New();
    static readonly AIProviderUsageDay _usageDay = new(new DateOnly(2026, 8, 1), "claude-sonnet-4-5", 100, 0, 0, 0);

    IReadOnlyDictionary<AIProviderId, ProviderUsageLevel> _result;

    void Establish()
    {
        ProviderIs(_healthy, new(_healthy, AIProviderType.Anthropic, "sk-ant-test"));
        ProviderIs(_unreachable, new(_unreachable, AIProviderType.Anthropic, "sk-ant-test-2"));
        RecentBurnIs(_unreachable, 50);

        _usageReporting.ForMany(Arg.Any<IReadOnlyCollection<PackageAIProviderId>>(), Arg.Any<TimeSpan>())
            .Returns(new Dictionary<PackageAIProviderId, AIProviderUsageReport>
            {
                [(PackageAIProviderId)_healthy.Value] = new((PackageAIProviderId)_healthy.Value, AIUsageReportAvailability.Available, [_usageDay], []),
                [(PackageAIProviderId)_unreachable.Value] = new((PackageAIProviderId)_unreachable.Value, AIUsageReportAvailability.Unreachable, [], []),
            });
    }

    async Task Because() => _result = await _levels.RefreshMany([_healthy, _unreachable]);

    [Fact] void should_answer_for_both_providers() => _result.Count.ShouldEqual(2);
    [Fact] void should_have_a_real_level_for_the_healthy_provider() => _result[_healthy].Availability.ShouldEqual(AIUsageReportAvailability.Available);

    [Fact]
    void should_have_fallen_back_to_local_burn_for_the_unreachable_provider() =>
        _result[_unreachable].UsedLocalBurnFallback.ShouldBeTrue();
}

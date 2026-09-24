// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.UsageReporting;
using PackageAIProviderId = Cratis.AI.Providers.AIProviderId;

namespace Cratis.AI.Providers.UsageReporting.for_ProviderUsageLevels.when_refreshing_many;

/// <summary>
/// A provider that has consumed more than its ceiling has zero tokens left, not a negative debt -
/// <see cref="Pools.PoolMemberSelector"/> treats exhausted capacity as a rank-last signal, and a
/// negative number would sort ahead of a merely-low one instead of behind it.
/// </summary>
public class and_the_provider_has_gone_over_its_ceiling : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly AIProviderUsageDay _usageDay = new(new DateOnly(2026, 8, 1), "claude-sonnet-4-5", 2_000, 0, 0, 0);

    IReadOnlyDictionary<AIProviderId, ProviderUsageLevel> _result;

    void Establish()
    {
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test") { UsageCapacity = 1_000 });
        _usageReporting.ForMany(Arg.Any<IReadOnlyCollection<PackageAIProviderId>>(), Arg.Any<TimeSpan>())
            .Returns(new Dictionary<PackageAIProviderId, AIProviderUsageReport>
            {
                [(PackageAIProviderId)_provider.Value] = new((PackageAIProviderId)_provider.Value, AIUsageReportAvailability.Available, [_usageDay], []),
            });
    }

    async Task Because() => _result = await _levels.RefreshMany([_provider]);

    [Fact] void should_clamp_remaining_capacity_to_zero() => _result[_provider].RemainingCapacity.ShouldEqual(0L);
}

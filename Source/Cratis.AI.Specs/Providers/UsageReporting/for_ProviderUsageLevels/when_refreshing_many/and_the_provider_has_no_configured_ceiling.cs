// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.UsageReporting;
using PackageAIProviderId = Cratis.AI.Providers.AIProviderId;

namespace Cratis.AI.Providers.UsageReporting.for_ProviderUsageLevels.when_refreshing_many;

/// <summary>
/// A provider with no configured <see cref="AIProviderUsageCapacity"/> ceiling has no remaining
/// capacity to measure - selection falls back to the existing least-burnt ranking for it
/// (issue #1061).
/// </summary>
public class and_the_provider_has_no_configured_ceiling : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly AIProviderUsageDay _usageDay = new(new DateOnly(2026, 8, 1), "claude-sonnet-4-5", 100, 10, 20, 50);

    IReadOnlyDictionary<AIProviderId, ProviderUsageLevel> _result;

    void Establish()
    {
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test"));
        _usageReporting.ForMany(Arg.Any<IReadOnlyCollection<PackageAIProviderId>>(), Arg.Any<TimeSpan>())
            .Returns(new Dictionary<PackageAIProviderId, AIProviderUsageReport>
            {
                [(PackageAIProviderId)_provider.Value] = new((PackageAIProviderId)_provider.Value, AIUsageReportAvailability.Available, [_usageDay], []),
            });
    }

    async Task Because() => _result = await _levels.RefreshMany([_provider]);

    [Fact] void should_have_no_known_remaining_capacity() => _result[_provider].RemainingCapacity.ShouldBeNull();
}

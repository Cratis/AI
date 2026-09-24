// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.UsageReporting;
using PackageAIProviderId = Cratis.AI.Providers.AIProviderId;

namespace Cratis.AI.Providers.UsageReporting.for_ProviderUsageLevels.when_refreshing_many;

/// <summary>
/// A provider with no usage credential configured falls back to Direct's own trailing-week burn,
/// rather than leaving its consumption unknown - the same fallback a provider with an unreachable
/// vendor report gets (issue #1061).
/// </summary>
public class and_the_vendor_report_is_unavailable : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    IReadOnlyDictionary<AIProviderId, ProviderUsageLevel> _result;

    void Establish()
    {
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test") { UsageCapacity = 1_000 });
        RecentBurnIs(_provider, 300);
        _usageReporting.ForMany(Arg.Any<IReadOnlyCollection<PackageAIProviderId>>(), Arg.Any<TimeSpan>())
            .Returns(new Dictionary<PackageAIProviderId, AIProviderUsageReport>
            {
                [(PackageAIProviderId)_provider.Value] = new((PackageAIProviderId)_provider.Value, AIUsageReportAvailability.NoCredentialConfigured, [], []),
            });
    }

    async Task Because() => _result = await _levels.RefreshMany([_provider]);

    [Fact] void should_have_used_the_local_burn_fallback() => _result[_provider].UsedLocalBurnFallback.ShouldBeTrue();
    [Fact] void should_have_consumed_the_locally_recorded_burn() => _result[_provider].ConsumedTokens.ShouldEqual(300L);
    [Fact] void should_compute_remaining_capacity_from_the_fallback() => _result[_provider].RemainingCapacity.ShouldEqual(700L);
}

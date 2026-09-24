// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers;
using Cratis.AI.Providers.UsageReporting;
using Cratis.AI.Providers.UsageReporting.RecordingSnapshot;
using PackageAIProviderId = Cratis.AI.Providers.AIProviderId;

namespace Cratis.AI.Providers.UsageReporting.for_ProviderUsageLevels.when_refreshing_many;

public class and_a_ceiling_is_configured_and_the_vendor_report_is_available : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly AIProviderUsageDay _usageDay = new(new DateOnly(2026, 8, 1), "claude-sonnet-4-5", 100, 10, 20, 50);

    IReadOnlyDictionary<AIProviderId, ProviderUsageLevel> _result;

    void Establish()
    {
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "sk-ant-test") { UsageCapacity = 1_000 });
        _usageReporting.ForMany(Arg.Is<IReadOnlyCollection<PackageAIProviderId>>(ids => ids.Contains((PackageAIProviderId)_provider.Value)), Arg.Any<TimeSpan>())
            .Returns(new Dictionary<PackageAIProviderId, AIProviderUsageReport>
            {
                [(PackageAIProviderId)_provider.Value] = new((PackageAIProviderId)_provider.Value, AIUsageReportAvailability.Available, [_usageDay], []),
            });
    }

    async Task Because() => _result = await _levels.RefreshMany([_provider]);

    [Fact] void should_sum_the_reported_tokens() => _result[_provider].ConsumedTokens.ShouldEqual(180L);
    [Fact] void should_not_have_used_the_local_burn_fallback() => _result[_provider].UsedLocalBurnFallback.ShouldBeFalse();
    [Fact] void should_compute_remaining_capacity_against_the_ceiling() => _result[_provider].RemainingCapacity.ShouldEqual(820L);

    [Fact]
    async Task should_have_recorded_the_snapshot() =>
        await _commandPipeline.Received(1).Execute(Arg.Is<RecordAIProviderUsageSnapshot>(command =>
            command.Provider == _provider && command.ConsumedTokens == 180 && !command.UsedLocalBurnFallback));
}

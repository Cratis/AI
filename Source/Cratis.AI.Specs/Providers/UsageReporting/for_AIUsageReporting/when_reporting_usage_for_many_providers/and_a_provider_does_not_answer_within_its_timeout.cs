// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Providers.UsageReporting.for_AIUsageReporting.when_reporting_usage_for_many_providers;

/// <summary>
/// A vendor call that simply never answers must not hold up the whole refresh - it degrades to
/// unreachable for this call once its own timeout elapses, the same as an outright failure.
/// </summary>
public class and_a_provider_does_not_answer_within_its_timeout : given.all_dependencies
{
    static readonly AIProviderId _slow = AIProviderId.New();

    IReadOnlyDictionary<AIProviderId, AIProviderUsageReport> _result;

    void Establish()
    {
        ProviderIs(_slow, new(_slow, AIProviderType.Anthropic, "completions-key") { UsageApiKey = "sk-ant-admin01-slow" });
        _anthropicReporter.ReportFor(Arg.Any<ConfiguredAIProvider>())
            .Returns(async _ =>
            {
                await Task.Delay(TimeSpan.FromSeconds(30));
                return new AIProviderUsageData([], []);
            });
    }

    async Task Because() => _result = await _usageReporting.ForMany([_slow], TimeSpan.FromMilliseconds(20));

    [Fact] void should_answer_as_unreachable_for_this_refresh() => _result[_slow].Availability.ShouldEqual(AIUsageReportAvailability.Unreachable);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Providers.UsageReporting.for_AIUsageReporting.when_reporting_usage_for_a_provider;

/// <summary>
/// Verifies the whole chain: the provider is resolved, its stored usage key reaches the vendor
/// reporter revealed at the moment it is spent, and the reporter's answer comes back as-is.
/// </summary>
public class and_the_reporter_succeeds : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();
    static readonly AIProviderUsageDay _usageDay = new(new DateOnly(2026, 8, 1), "claude-sonnet-4-5", 100, 10, 20, 50);
    static readonly AIProviderCostDay _costDay = new(new DateOnly(2026, 8, 1), 1.23m);

    AIProviderUsageReport _result;

    void Establish()
    {
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "completions-key") { UsageApiKey = "protected:sk-ant-admin01-test" });
        _revealer.Reveal("protected:sk-ant-admin01-test").Returns("sk-ant-admin01-test");
        _anthropicReporter.ReportFor(Arg.Any<ConfiguredAIProvider>()).Returns(new AIProviderUsageData([_usageDay], [_costDay]));
    }

    async Task Because() => _result = await _usageReporting.For(_provider);

    [Fact] void should_answer_as_available() => _result.Availability.ShouldEqual(AIUsageReportAvailability.Available);
    [Fact] void should_answer_with_the_reporters_token_usage() => _result.TokenUsage.ShouldContainOnly(_usageDay);
    [Fact] void should_answer_with_the_reporters_costs() => _result.Costs.ShouldContainOnly(_costDay);

    [Fact]
    void should_hand_the_reporter_the_revealed_key() =>
        _anthropicReporter.Received(1).ReportFor(Arg.Is<ConfiguredAIProvider>(provider => provider.UsageApiKey == new AIProviderApiKey("sk-ant-admin01-test")));
}

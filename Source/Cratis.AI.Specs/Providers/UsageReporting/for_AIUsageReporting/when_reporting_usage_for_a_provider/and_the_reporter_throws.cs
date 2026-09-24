// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Cratis.AI.Providers.UsageReporting.for_AIUsageReporting.when_reporting_usage_for_a_provider;

public class and_the_reporter_throws : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    AIProviderUsageReport _result;

    void Establish()
    {
        ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "completions-key") { UsageApiKey = "sk-ant-admin01-test" });
        _anthropicReporter.ReportFor(Arg.Any<ConfiguredAIProvider>()).Throws(new HttpRequestException("boom"));
    }

    async Task Because() => _result = await _usageReporting.For(_provider);

    [Fact] void should_answer_as_unreachable() => _result.Availability.ShouldEqual(AIUsageReportAvailability.Unreachable);
    [Fact] void should_answer_with_no_token_usage() => _result.TokenUsage.ShouldBeEmpty();
    [Fact] void should_answer_with_no_costs() => _result.Costs.ShouldBeEmpty();
}

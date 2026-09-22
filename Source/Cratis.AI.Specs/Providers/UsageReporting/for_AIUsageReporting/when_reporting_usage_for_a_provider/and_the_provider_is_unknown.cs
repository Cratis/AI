// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Providers.UsageReporting.for_AIUsageReporting.when_reporting_usage_for_a_provider;

public class and_the_provider_is_unknown : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    AIProviderUsageReport _result;

    void Establish() => ProviderIs(_provider, null);

    async Task Because() => _result = await _usageReporting.For(_provider);

    [Fact] void should_answer_as_not_supported_for_the_vendor() => _result.Availability.ShouldEqual(AIUsageReportAvailability.NotSupportedForVendor);
    [Fact] void should_answer_with_no_token_usage() => _result.TokenUsage.ShouldBeEmpty();
    [Fact] void should_answer_with_no_costs() => _result.Costs.ShouldBeEmpty();
    [Fact] void should_not_ask_any_reporter() => _anthropicReporter.DidNotReceive().ReportFor(Arg.Any<ConfiguredAIProvider>());
}

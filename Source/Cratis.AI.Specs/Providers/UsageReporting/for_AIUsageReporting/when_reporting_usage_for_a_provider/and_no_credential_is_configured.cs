// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;

namespace Cratis.AI.Providers.UsageReporting.for_AIUsageReporting.when_reporting_usage_for_a_provider;

public class and_no_credential_is_configured : given.all_dependencies
{
    static readonly AIProviderId _provider = AIProviderId.New();

    AIProviderUsageReport _result;

    void Establish() => ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "completions-key"));

    async Task Because() => _result = await _usageReporting.For(_provider);

    [Fact] void should_answer_as_no_credential_configured() => _result.Availability.ShouldEqual(AIUsageReportAvailability.NoCredentialConfigured);
    [Fact] void should_not_ask_the_reporter() => _anthropicReporter.DidNotReceive().ReportFor(Arg.Any<ConfiguredAIProvider>());
}

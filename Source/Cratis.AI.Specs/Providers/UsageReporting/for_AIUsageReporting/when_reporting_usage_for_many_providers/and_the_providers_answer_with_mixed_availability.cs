// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace Cratis.AI.Providers.UsageReporting.for_AIUsageReporting.when_reporting_usage_for_many_providers;

/// <summary>
/// One provider unreachable must not take down the refresh for the others - each provider's own
/// <see cref="ICanReportAIUsage"/> call is independent, so a fanned-out failure degrades only its own
/// answer.
/// </summary>
public class and_the_providers_answer_with_mixed_availability : given.all_dependencies
{
    static readonly AIProviderId _available = AIProviderId.New();
    static readonly AIProviderId _unreachable = AIProviderId.New();
    static readonly AIProviderId _noCredential = AIProviderId.New();
    static readonly AIProviderUsageDay _usageDay = new(new DateOnly(2026, 8, 1), "claude-sonnet-4-5", 100, 10, 20, 50);

    IReadOnlyDictionary<AIProviderId, AIProviderUsageReport> _result;

    void Establish()
    {
        ProviderIs(_available, new(_available, AIProviderType.Anthropic, "completions-key") { UsageApiKey = "protected:sk-ant-admin01-available" });
        ProviderIs(_unreachable, new(_unreachable, AIProviderType.Anthropic, "completions-key") { UsageApiKey = "protected:sk-ant-admin01-unreachable" });
        ProviderIs(_noCredential, new(_noCredential, AIProviderType.Anthropic, "completions-key"));

        _anthropicReporter.ReportFor(Arg.Is<ConfiguredAIProvider>(provider => provider.Id == _available))
            .Returns(new AIProviderUsageData([_usageDay], []));
        _anthropicReporter.ReportFor(Arg.Is<ConfiguredAIProvider>(provider => provider.Id == _unreachable))
            .Throws(new HttpRequestException("boom"));
    }

    async Task Because() => _result = await _usageReporting.ForMany([_available, _unreachable, _noCredential], TimeSpan.FromSeconds(5));

    [Fact] void should_answer_for_every_provider() => _result.Count.ShouldEqual(3);
    [Fact] void should_answer_the_healthy_provider_as_available() => _result[_available].Availability.ShouldEqual(AIUsageReportAvailability.Available);
    [Fact] void should_answer_the_failing_provider_as_unreachable() => _result[_unreachable].Availability.ShouldEqual(AIUsageReportAvailability.Unreachable);
    [Fact] void should_answer_the_uncredentialed_provider_as_no_credential_configured() => _result[_noCredential].Availability.ShouldEqual(AIUsageReportAvailability.NoCredentialConfigured);
}

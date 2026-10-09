// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.UsageReporting;

namespace Cratis.AI.Providers.for_AIProviderApiKey.when_reading_usage;

public class with_encrypted_envelopes : given.outbound_credentials
{
    ICanReportAIUsage[] _reporters = [];

    void Establish() => _reporters = [new AnthropicUsageReporting(_http, TimeProvider.System), new OpenAIUsageReporting(_http, TimeProvider.System)];

    async Task Because() => _errors = await Task.WhenAll(_reporters.SelectMany(reporter => Envelopes.Select(envelope =>
        Catch.Exception(() => reporter.ReportFor(new ConfiguredAIProvider(AIProviderId.New(), reporter.Type, "valid-completion-key") { UsageApiKey = envelope })))));

    [Fact] void should_require_reconfiguration_for_each_envelope() => _errors.All(error => error is AIProviderRequiresReconfiguration).ShouldBeTrue();
    [Fact] void should_not_send_any_http_request() => _sent.ShouldEqual(0);
}

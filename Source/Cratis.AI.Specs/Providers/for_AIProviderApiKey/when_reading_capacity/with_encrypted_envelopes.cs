// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Capacity;
using Microsoft.Extensions.Options;

namespace Cratis.AI.Providers.for_AIProviderApiKey.when_reading_capacity;

public class with_encrypted_envelopes : given.outbound_credentials
{
    ICanReportAIProviderCapacity[] _reporters = [];

    void Establish()
    {
        var options = Options.Create(new AIProviderOptions());
        _reporters = [new ClaudeSubscriptionCapacity(_http, options), new ChatGPTSubscriptionCapacity(_http, TimeProvider.System, options), new CopilotCapacity(_http, options), new ZAICodingPlanCapacity(_http, options)];
    }

    async Task Because() => _errors = await Task.WhenAll(_reporters.SelectMany(reporter => Envelopes.Select(envelope =>
        Catch.Exception(() => reporter.Report(new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.ZAI, envelope), CancellationToken.None)))));

    [Fact] void should_require_reconfiguration_for_each_envelope() => _errors.All(error => error is AIProviderRequiresReconfiguration).ShouldBeTrue();
    [Fact] void should_not_send_any_http_request() => _sent.ShouldEqual(0);
}

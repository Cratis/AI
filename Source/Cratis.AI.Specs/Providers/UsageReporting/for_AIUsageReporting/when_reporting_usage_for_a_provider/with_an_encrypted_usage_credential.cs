// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.UsageReporting.for_AIUsageReporting.when_reporting_usage_for_a_provider;

public class with_an_encrypted_usage_credential : given.all_dependencies
{
    readonly AIProviderId _provider = AIProviderId.New();
    Exception? _error;

    void Establish() => ProviderIs(_provider, new(_provider, AIProviderType.Anthropic, "valid-key") { UsageApiKey = "enc:v1:secret" });

    async Task Because() => _error = await Catch.Exception(() => _usageReporting.For(_provider));

    [Fact] void should_require_reconfiguration() => _error.ShouldBeOfExactType<AIProviderRequiresReconfiguration>();
    [Fact] async Task should_not_release_the_envelope_to_the_reporter() => await _anthropicReporter.DidNotReceiveWithAnyArgs().ReportFor(default!);
}

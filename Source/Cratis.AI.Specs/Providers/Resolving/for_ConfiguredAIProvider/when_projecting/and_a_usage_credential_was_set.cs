// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.UsageReporting.SettingCredential;

namespace Cratis.AI.Providers.for_ConfiguredAIProvider.when_projecting;

/// <summary>
/// The usage key has to reach the model that resolves a provider at the point of use, not only the
/// listing's "configured" flag - the catalog read and the usage report are both spent from here.
/// </summary>
public class and_a_usage_credential_was_set : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();

    ReadModelScenario<ConfiguredAIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_providerId).Events(
        new AnthropicProviderAdded("Einars Claude", "sk-ant-oat01-subscription", 4),
        new AIProviderUsageCredentialSet("sk-ant-admin01-organization"));

    [Fact] void should_keep_the_completions_credential() => _scenario.Instance.ApiKey.Value.ShouldEqual("sk-ant-oat01-subscription");

    [Fact] void should_carry_the_usage_credential() => _scenario.Instance.UsageApiKey!.Value.ShouldEqual("sk-ant-admin01-organization");
}

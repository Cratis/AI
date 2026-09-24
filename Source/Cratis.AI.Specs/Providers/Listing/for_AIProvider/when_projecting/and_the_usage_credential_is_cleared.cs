// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.Adding;
using Cratis.AI.Providers.UsageReporting.SettingCredential;

namespace Cratis.AI.Providers.Listing.for_AIProvider.when_projecting;

/// <summary>
/// The credentials dialog says which of the two keys is set, and it has to be telling the truth
/// after a removal - a row still claiming "configured" would have somebody hunting a spend report
/// that stopped on purpose.
/// </summary>
public class and_the_usage_credential_is_cleared : Specification
{
    static readonly AIProviderId _providerId = AIProviderId.New();

    ReadModelScenario<AIProvider> _scenario;

    void Establish() => _scenario = new();

    async Task Because() => await _scenario.Given.ForEventSource(_providerId).Events(
        new AnthropicProviderAdded("Einars Claude", "sk-ant-key", 4),
        new AIProviderUsageCredentialSet("sk-ant-admin01-test"),
        new AIProviderUsageCredentialCleared());

    [Fact] void should_say_it_has_no_usage_credential() => _scenario.Instance.HasUsageCredential.ShouldBeFalse();
}

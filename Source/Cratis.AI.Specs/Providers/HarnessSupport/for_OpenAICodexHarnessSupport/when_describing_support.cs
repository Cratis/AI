// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Providers.HarnessSupport.for_OpenAICodexHarnessSupport;

public class when_describing_support : Specification
{
    const string SubscriptionRecord = """{"type":"oauth","access":"tok","refresh":"rt","expires":4102444800000}""";

    readonly OpenAICodexHarnessSupport _support = new();

    [Fact] void should_be_for_the_codex_provider() => _support.Type.ShouldEqual(AIProviderType.OpenAICodex);
    [Fact] void should_support_only_pi() => _support.SupportedHarnesses.ShouldContainOnly(Harness.Pi);
    [Fact] void should_map_to_pis_codex_provider() => _support.PiProviderIdFor(SubscriptionRecord).ShouldEqual("openai-codex");
    [Fact] void should_use_the_oauth_credential_file() => _support.ApiKeyVariableFor(Harness.Pi, SubscriptionRecord).ShouldEqual("DIRECT_PI_OAUTH_CREDENTIAL");
    [Fact] void should_accept_a_complete_subscription_record() => _support.SupportsCredential(Harness.Pi, SubscriptionRecord).ShouldBeTrue();
    [Fact] void should_reject_an_api_key() => _support.SupportsCredential(Harness.Pi, "sk-openai-key").ShouldBeFalse();
}

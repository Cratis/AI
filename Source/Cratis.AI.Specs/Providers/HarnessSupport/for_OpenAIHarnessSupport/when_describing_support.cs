// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Providers.HarnessSupport.for_OpenAIHarnessSupport;

public class when_describing_support : Specification
{
    const string SubscriptionRecord = """{"type":"oauth","access":"tok","refresh":"rt","expires":4102444800000}""";

    readonly OpenAIHarnessSupport _support = new();

    [Fact] void should_be_for_the_openai_vendor() => _support.Type.ShouldEqual(AIProviderType.OpenAI);
    [Fact] void should_not_support_claude() => _support.SupportedHarnesses.ShouldNotContain(Harness.Claude);
    [Fact] void should_support_pi() => _support.SupportedHarnesses.ShouldContain(Harness.Pi);
    [Fact] void should_map_to_the_openai_pi_provider_id() => _support.PiProviderIdFor("sk-openai-key").ShouldEqual("openai");
    [Fact] void should_let_pi_use_its_credential() => _support.SupportsCredential(Harness.Pi, "sk-openai-key").ShouldBeTrue();
    [Fact] void should_not_let_claude_use_its_credential() => _support.SupportsCredential(Harness.Claude, "sk-openai-key").ShouldBeFalse();
    [Fact] void should_map_its_credential_to_the_vendor_variable() => _support.ApiKeyVariableFor(Harness.Claude, "sk-openai-key").ShouldEqual("OPENAI_API_KEY");

    // A ChatGPT subscription reaches the same models through an entirely different Pi provider and
    // endpoint, so the credential moves both the provider id and the variable it travels in.
    [Fact] void should_map_a_subscription_to_pis_codex_provider() => _support.PiProviderIdFor(SubscriptionRecord).ShouldEqual("openai-codex");
    [Fact] void should_map_a_subscription_to_the_oauth_credential_variable() => _support.ApiKeyVariableFor(Harness.Pi, SubscriptionRecord).ShouldEqual("DIRECT_PI_OAUTH_CREDENTIAL");
    [Fact] void should_let_pi_use_a_subscription() => _support.SupportsCredential(Harness.Pi, SubscriptionRecord).ShouldBeTrue();

    // Pi reports a record missing its refresh token or expiry only as invalid_state, from inside a
    // container that has already been launched - so it is refused here instead.
    [Fact]
    void should_refuse_a_subscription_record_with_no_refresh_token() =>
        _support.SupportsCredential(Harness.Pi, """{"type":"oauth","access":"tok","expires":4102444800000}""").ShouldBeFalse();

    [Fact]
    void should_refuse_a_truncated_subscription_record() =>
        _support.SupportsCredential(Harness.Pi, """{"type":"oauth","access":"tok""").ShouldBeFalse();
}

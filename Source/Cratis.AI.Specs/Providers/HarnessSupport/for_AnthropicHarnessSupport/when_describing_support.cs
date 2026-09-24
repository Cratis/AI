// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Providers.HarnessSupport.for_AnthropicHarnessSupport;

public class when_describing_support : Specification
{
    readonly AnthropicHarnessSupport _support = new();

    [Fact] void should_be_for_the_anthropic_vendor() => _support.Type.ShouldEqual(AIProviderType.Anthropic);
    [Fact] void should_support_claude() => _support.SupportedHarnesses.ShouldContain(Harness.Claude);
    [Fact] void should_support_pi() => _support.SupportedHarnesses.ShouldContain(Harness.Pi);
    [Fact] void should_map_to_the_anthropic_pi_provider_id() => _support.PiProviderIdFor("sk-ant-api03-key").ShouldEqual("anthropic");

    [Fact] void should_let_claude_use_an_api_key() => _support.SupportsCredential(Harness.Claude, "sk-ant-api03-key").ShouldBeTrue();
    [Fact] void should_let_claude_use_an_oauth_token() => _support.SupportsCredential(Harness.Claude, "sk-ant-oat01-token").ShouldBeTrue();
    [Fact] void should_let_pi_use_an_api_key() => _support.SupportsCredential(Harness.Pi, "sk-ant-api03-key").ShouldBeTrue();

    // Pi's Anthropic provider authenticates the API-key way only - it sends whatever
    // ANTHROPIC_API_KEY holds as an x-api-key header and has no bearer-token mode.
    [Fact] void should_not_let_pi_use_an_oauth_token() => _support.SupportsCredential(Harness.Pi, "sk-ant-oat01-token").ShouldBeFalse();

    [Fact] void should_map_an_api_key_to_the_vendor_variable() => _support.ApiKeyVariableFor(Harness.Claude, "sk-ant-api03-key").ShouldEqual("ANTHROPIC_API_KEY");
    [Fact] void should_map_an_oauth_token_to_the_claude_code_variable() => _support.ApiKeyVariableFor(Harness.Claude, "sk-ant-oat01-token").ShouldEqual("CLAUDE_CODE_OAUTH_TOKEN");
}

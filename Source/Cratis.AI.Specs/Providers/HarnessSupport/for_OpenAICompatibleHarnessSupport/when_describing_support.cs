// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Providers.HarnessSupport.for_OpenAICompatibleHarnessSupport;

public class when_describing_support : Specification
{
    readonly OpenAICompatibleHarnessSupport _support = new();

    [Fact] void should_be_for_the_openai_compatible_vendor() => _support.Type.ShouldEqual(AIProviderType.OpenAICompatible);
    [Fact] void should_not_support_claude() => _support.SupportedHarnesses.ShouldNotContain(Harness.Claude);
    [Fact] void should_support_pi() => _support.SupportedHarnesses.ShouldContain(Harness.Pi);
    [Fact] void should_map_to_the_gateways_declared_pi_provider_id() => _support.PiProviderIdFor("gateway-key").ShouldEqual("direct-openai-compatible");
    [Fact] void should_let_pi_use_its_credential() => _support.SupportsCredential(Harness.Pi, "gateway-key").ShouldBeTrue();
    [Fact] void should_not_let_claude_use_its_credential() => _support.SupportsCredential(Harness.Claude, "gateway-key").ShouldBeFalse();
    [Fact] void should_map_its_credential_to_the_stagehand_defined_variable() => _support.ApiKeyVariableFor(Harness.Claude, "gateway-key").ShouldEqual("DIRECT_PROVIDER_API_KEY");
}

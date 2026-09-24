// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;

namespace Cratis.AI.Providers.HarnessSupport.for_AzureOpenAIHarnessSupport;

public class when_describing_support : Specification
{
    readonly AzureOpenAIHarnessSupport _support = new();

    [Fact] void should_be_for_the_azure_openai_vendor() => _support.Type.ShouldEqual(AIProviderType.AzureOpenAI);
    [Fact] void should_not_support_claude() => _support.SupportedHarnesses.ShouldNotContain(Harness.Claude);
    [Fact] void should_support_pi() => _support.SupportedHarnesses.ShouldContain(Harness.Pi);
    [Fact] void should_map_to_the_azure_openai_pi_provider_id() => _support.PiProviderIdFor("azure-key").ShouldEqual("azure-openai-responses");
    [Fact] void should_let_pi_use_its_credential() => _support.SupportsCredential(Harness.Pi, "azure-key").ShouldBeTrue();
    [Fact] void should_not_let_claude_use_its_credential() => _support.SupportsCredential(Harness.Claude, "azure-key").ShouldBeFalse();
    [Fact] void should_map_its_credential_to_the_vendor_variable() => _support.ApiKeyVariableFor(Harness.Claude, "azure-key").ShouldEqual("AZURE_OPENAI_API_KEY");
}

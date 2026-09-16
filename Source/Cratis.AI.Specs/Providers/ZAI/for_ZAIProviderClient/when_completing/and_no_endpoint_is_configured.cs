// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;
using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.ZAI.for_ZAIProviderClient.when_completing;

/// <summary>
/// A provider with no explicit endpoint means Z.ai's own public gateway - the same default a
/// harness container is handed.
/// </summary>
public class and_no_endpoint_is_configured : given.a_stub_message_server
{
    ConfiguredAIProvider _provider;
    LanguageModelResult _result;

    void Establish() => _provider = new ConfiguredAIProvider(AIProviderId.New(), AIProviderType.ZAI, new AIProviderApiKey("zai-key"));

    async Task Because() => _result = await Client.Complete("prompt", _provider, new ModelName("glm-4.6"), Effort.Medium);

    [Fact] void should_succeed() => _result.Succeeded.ShouldBeTrue();
    [Fact] void should_call_the_default_gateway() => Handler.LastRequest!.RequestUri!.ToString().ShouldEqual($"{ZAIProviderClient.DefaultEndpoint}/v1/messages");
    [Fact] void should_authenticate_as_a_bearer_token() => Handler.LastRequest!.Headers.GetValues("authorization").Single().ShouldEqual("Bearer zai-key");
}

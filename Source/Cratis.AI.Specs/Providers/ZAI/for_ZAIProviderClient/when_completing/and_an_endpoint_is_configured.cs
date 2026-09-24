// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Agents;
using Cratis.AI.Common;

namespace Cratis.AI.Providers.ZAI.for_ZAIProviderClient.when_completing;

/// <summary>
/// An explicit endpoint - a private gateway, a regional mirror - overrides Z.ai's public default.
/// </summary>
public class and_an_endpoint_is_configured : given.a_stub_message_server
{
    ConfiguredAIProvider _provider;

    void Establish() => _provider = new ConfiguredAIProvider(
        AIProviderId.New(),
        AIProviderType.ZAI,
        new AIProviderApiKey("zai-key"))
    {
        Endpoint = new AIProviderEndpoint("https://zai.example.com/")
    };

    async Task Because() => await Client.Complete("prompt", _provider, new ModelName("glm-4.6"), Effort.Medium);

    [Fact] void should_call_the_configured_endpoint() => Handler.LastRequest!.RequestUri!.ToString().ShouldEqual("https://zai.example.com/v1/messages");
}

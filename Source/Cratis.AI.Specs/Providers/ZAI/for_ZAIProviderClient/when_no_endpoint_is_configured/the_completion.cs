// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.LanguageModels;

namespace Cratis.AI.Providers.ZAI.for_ZAIProviderClient.when_no_endpoint_is_configured;

public class the_completion : given.a_client_with_a_stubbed_endpoint
{
    LanguageModelResult _result;

    void Establish() => _provider = _provider with { Endpoint = AIProviderEndpoint.NotSet };

    async Task Because() => _result = await PerformCompletion();

    [Fact] void should_fall_back_to_zai_default_endpoint() => _request.RequestUri!.ToString().ShouldEqual("https://api.z.ai/api/anthropic/v1/messages");
    [Fact] void should_succeed() => _result.Succeeded.ShouldBeTrue();
}

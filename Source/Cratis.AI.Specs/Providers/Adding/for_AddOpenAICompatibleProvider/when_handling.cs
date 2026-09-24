// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Adding.for_AddOpenAICompatibleProvider;

/// <summary>
/// Many self-hosted gateways accept requests unauthenticated - the API key is optional, unlike every
/// other vendor's Add command.
/// </summary>
public class when_handling : Specification
{
    static readonly AIProviderName _name = new("Local Ollama");
    static readonly AIProviderEndpoint _endpoint = new("http://localhost:11434");

    AddOpenAICompatibleProvider _command;
    (AIProviderId Id, OpenAICompatibleProviderAdded Event) _result;

    void Establish()
    {
        _command = new AddOpenAICompatibleProvider(_name, _endpoint, AIProviderApiKey.NotSet, MaxConcurrentJobs.NotSet);
    }

    void Because() => _result = _command.Handle();

    [Fact] void should_carry_the_endpoint() => _result.Event.Endpoint.ShouldEqual(_endpoint);
    [Fact] void should_have_no_api_key() => _result.Event.ApiKey.ShouldEqual(AIProviderApiKey.NotSet);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Adding.for_AddAnthropicProvider;

public class when_handling : Specification
{
    static readonly AIProviderName _name = new("My Anthropic key");
    static readonly AIProviderApiKey _apiKey = new("sk-ant-live-token");
    static readonly MaxConcurrentJobs _maxConcurrentJobs = new(3);

    AddAnthropicProvider _command;
    (AIProviderId Id, AnthropicProviderAdded Event) _result;

    void Establish()
    {
        _command = new AddAnthropicProvider(_name, _apiKey, _maxConcurrentJobs);
    }

    void Because() => _result = _command.Handle();

    [Fact] void should_generate_a_new_provider_identity() => _result.Id.Value.ShouldNotBeNull();
    [Fact] void should_carry_the_name() => _result.Event.Name.ShouldEqual(_name);
    [Fact] void should_carry_the_api_key() => _result.Event.ApiKey.Value.ShouldEqual(_apiKey.Value);
    [Fact] void should_carry_the_concurrency_limit() => _result.Event.MaxConcurrentJobs.ShouldEqual(_maxConcurrentJobs);
}

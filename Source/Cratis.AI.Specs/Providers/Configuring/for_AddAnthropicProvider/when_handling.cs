// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Configuring.for_AddAnthropicProvider;

public class when_handling : Specification
{
    static readonly AIProviderName _name = new("Studio's Anthropic key");
    static readonly AIProviderApiKey _apiKey = new("sk-ant-live-token");

    AddAnthropicProvider _command;
    (AIProviderId Id, AnthropicModelConfigured Event) _result;

    void Establish()
    {
        _command = new AddAnthropicProvider(_name, _apiKey);
    }

    void Because() => _result = _command.Handle();

    [Fact] void should_generate_a_new_provider_identity() => _result.Id.Value.ShouldNotBeNull();
    [Fact] void should_carry_the_name() => _result.Event.Name.ShouldEqual(_name);
    [Fact] void should_carry_the_api_key() => _result.Event.ApiKey.Value.ShouldEqual(_apiKey.Value);
    [Fact] void should_leave_the_model_unset() => _result.Event.Model.ShouldEqual(Common.ModelName.NotSet);
}

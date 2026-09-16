// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using NSubstitute;

namespace Cratis.AI.Providers.Configuring.for_AddAnthropicProvider;

public class when_handling : Specification
{
    static readonly AIProviderName _name = new("Studio's Anthropic key");
    static readonly AIProviderApiKey _apiKey = new("sk-ant-live-token");

    ISecretProtector _protector;
    AddAnthropicProvider _command;
    (AIProviderId Id, AnthropicModelConfigured Event) _result;

    void Establish()
    {
        _protector = Substitute.For<ISecretProtector>();
        _protector.Protect(_apiKey.Value).Returns("protected:" + _apiKey.Value);
        _command = new AddAnthropicProvider(_name, _apiKey);
    }

    async Task Because() => _result = await _command.Handle(_protector);

    [Fact] void should_generate_a_new_provider_identity() => _result.Id.Value.ShouldNotBeNull();
    [Fact] void should_carry_the_name() => _result.Event.Name.ShouldEqual(_name);
    [Fact] void should_protect_the_api_key() => _result.Event.ApiKey.Value.ShouldEqual("protected:" + _apiKey.Value);
    [Fact] void should_leave_the_model_unset() => _result.Event.Model.ShouldEqual(Common.ModelName.NotSet);
}

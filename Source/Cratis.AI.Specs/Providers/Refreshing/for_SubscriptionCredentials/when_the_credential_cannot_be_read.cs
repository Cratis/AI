// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Providers.OpenAI;

namespace Cratis.AI.Providers.Refreshing.for_SubscriptionCredentials;

/// <summary>
/// A half-pasted record is a misconfiguration. It is caught here rather than in a container, where
/// Pi would report it only as invalid_state.
/// </summary>
public class when_the_credential_cannot_be_read : given.all_dependencies
{
    AIProviderApiKey? _result;

    async Task Because() => _result = await _credentials.EnsureCurrent(_provider, """{"type":"oauth","access":"at""");

    [Fact] void should_not_hand_back_a_credential() => _result.ShouldBeNull();
    [Fact] void should_not_exchange_anything() => _tokens.DidNotReceive().Refresh(Arg.Any<OpenAISubscriptionCredential>(), Arg.Any<CancellationToken>());
    [Fact] void should_not_record_a_rotation() => _commandPipeline.DidNotReceive().Execute(Arg.Any<RecordRefreshedOpenAISubscription>());
    [Fact] void should_raise_an_alert() => _alerts.Received(1).Raise(Arg.Any<AIAlert>());
}

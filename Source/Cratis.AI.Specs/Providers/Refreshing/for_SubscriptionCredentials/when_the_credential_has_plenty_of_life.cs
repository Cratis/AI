// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Providers.OpenAI;

namespace Cratis.AI.Providers.Refreshing.for_SubscriptionCredentials;

/// <summary>
/// Every refresh retires the token it was minted from, so one is spent only when the session would
/// otherwise outlive its credential - not on every dispatch.
/// </summary>
public class when_the_credential_has_plenty_of_life : given.all_dependencies
{
    static readonly AIProviderApiKey _stored = CredentialExpiringIn(TimeSpan.FromHours(6));

    AIProviderApiKey? _result;

    async Task Because() => _result = await _credentials.EnsureCurrent(_provider, _stored);

    [Fact] void should_hand_back_the_stored_credential() => _result.ShouldEqual(_stored);
    [Fact] void should_not_exchange_anything() => _tokens.DidNotReceive().Refresh(Arg.Any<OpenAISubscriptionCredential>(), Arg.Any<CancellationToken>());
    [Fact] void should_not_record_a_rotation() => _commandPipeline.DidNotReceive().Execute(Arg.Any<RecordRefreshedOpenAISubscription>());

    // Nothing went wrong, so nothing may page anybody - an alert that fires on the happy path is an
    // alert people learn to ignore.
    [Fact] void should_not_raise_an_alert() => _alerts.DidNotReceive().Raise(Arg.Any<AIAlert>());
}

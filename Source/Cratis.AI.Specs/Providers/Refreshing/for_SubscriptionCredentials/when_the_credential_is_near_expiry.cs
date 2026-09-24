// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Providers.OpenAI;

namespace Cratis.AI.Providers.Refreshing.for_SubscriptionCredentials;

/// <summary>
/// The whole reason this component exists. OpenAI retires a refresh token as it is spent, so the
/// credential that comes back from an exchange is the only live one there is - it has to be recorded
/// before it is handed out, or the next dispatch authenticates with a token the vendor has already
/// discarded and the subscription is dead with nothing to point at.
/// </summary>
public class when_the_credential_is_near_expiry : given.all_dependencies
{
    static readonly AIProviderApiKey _stored = CredentialExpiringIn(TimeSpan.FromMinutes(5));
    static readonly OpenAISubscriptionCredential _refreshed = new("new-access", "rotated-refresh", DateTimeOffset.UtcNow.AddHours(8).ToUnixTimeMilliseconds(), "acct");

    AIProviderApiKey? _result;
    RecordRefreshedOpenAISubscription _recorded;

    void Establish()
    {
        _tokens.Refresh(Arg.Any<OpenAISubscriptionCredential>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult<OpenAISubscriptionCredential?>(_refreshed));

        _commandPipeline
            .When(_ => _.Execute(Arg.Any<RecordRefreshedOpenAISubscription>()))
            .Do(call => _recorded = call.Arg<RecordRefreshedOpenAISubscription>());
    }

    async Task Because() => _result = await _credentials.EnsureCurrent(_provider, _stored);

    [Fact]
    void should_spend_the_stored_refresh_token() =>
        _tokens.Received(1).Refresh(Arg.Is<OpenAISubscriptionCredential>(_ => _.Refresh == "refresh"), Arg.Any<CancellationToken>());

    [Fact] void should_hand_back_the_refreshed_credential() => OpenAISubscriptionCredential.TryParse(_result!)!.Access.ShouldEqual("new-access");
    [Fact] void should_record_the_rotation() => _recorded.ShouldNotBeNull();
    [Fact] void should_record_it_against_the_provider() => _recorded.Provider.ShouldEqual(_provider);

    // The rotated refresh token is the part that must survive - the access token expires on its own,
    // but losing the refresh token ends the subscription.
    [Fact] void should_record_the_rotated_refresh_token() => OpenAISubscriptionCredential.TryParse(_recorded.Credential)!.Refresh.ShouldEqual("rotated-refresh");
    [Fact] void should_record_exactly_what_it_hands_out() => _recorded.Credential.ShouldEqual(_result);

    // Nothing went wrong, so nothing may page anybody - an alert that fires on the happy path is an
    // alert people learn to ignore.
    [Fact] void should_not_raise_an_alert() => _alerts.DidNotReceive().Raise(Arg.Any<AIAlert>());
}

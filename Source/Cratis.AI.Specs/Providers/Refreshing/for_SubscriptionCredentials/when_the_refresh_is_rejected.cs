// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Abstractions;
using Cratis.AI.Providers.OpenAI;

namespace Cratis.AI.Providers.Refreshing.for_SubscriptionCredentials;

/// <summary>
/// A rejected exchange usually means the stored credential was already retired - someone logged in
/// again elsewhere, or a previous rotation was lost. Answering nothing leaves the work scheduled and
/// the reason in the log, rather than launching a container that cannot authenticate and burning a
/// session's retries against it.
/// </summary>
public class when_the_refresh_is_rejected : given.all_dependencies
{
    static readonly AIProviderApiKey _stored = CredentialExpiringIn(TimeSpan.FromMinutes(5));

    AIProviderApiKey? _result;

    void Establish() =>
        _tokens.Refresh(Arg.Any<OpenAISubscriptionCredential>(), Arg.Any<CancellationToken>())
            .Returns(_ => Task.FromResult<OpenAISubscriptionCredential?>(null));

    async Task Because() => _result = await _credentials.EnsureCurrent(_provider, _stored);

    [Fact] void should_not_hand_back_a_credential() => _result.ShouldBeNull();

    // Nothing was minted, so nothing may be recorded - writing the stored one back would look like a
    // successful rotation in the log.
    [Fact] void should_not_record_a_rotation() => _commandPipeline.DidNotReceive().Execute(Arg.Any<RecordRefreshedOpenAISubscription>());

    // The cluster runs by itself, so a log line would leave the queue quietly not moving. This is the
    // one failure that ends a subscription, and it has to reach somebody.
    [Fact]
    void should_raise_an_alert() =>
        _alerts.Received(1).Raise(Arg.Any<AIAlert>());

    // Keyed per provider, so a pass that keeps failing folds into one open alert rather than a fresh
    // one every scheduling cycle.
    [Fact]
    void should_name_the_provider_in_the_alert() =>
        _alerts.Received(1).Raise(Arg.Is<AIAlert>(alert => alert.Detail.Contains(_provider.ToString())));
}

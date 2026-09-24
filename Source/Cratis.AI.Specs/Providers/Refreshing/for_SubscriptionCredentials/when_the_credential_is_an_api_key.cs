// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Providers.OpenAI;

namespace Cratis.AI.Providers.Refreshing.for_SubscriptionCredentials;

/// <summary>
/// An API key does not expire and has nothing to rotate, so it passes through untouched - spending a
/// refresh on it would be meaningless, and treating it as a subscription would break every
/// keyed provider.
/// </summary>
public class when_the_credential_is_an_api_key : given.all_dependencies
{
    AIProviderApiKey? _result;

    async Task Because() => _result = await _credentials.EnsureCurrent(_provider, "sk-proj-abc");

    [Fact] void should_hand_back_the_same_credential() => _result!.Value.ShouldEqual("sk-proj-abc");
    [Fact] void should_not_exchange_anything() => _tokens.DidNotReceive().Refresh(Arg.Any<OpenAISubscriptionCredential>(), Arg.Any<CancellationToken>());
    [Fact] void should_not_record_a_rotation() => _commandPipeline.DidNotReceive().Execute(Arg.Any<RecordRefreshedOpenAISubscription>());
}

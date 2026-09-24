// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.OpenAI.for_OpenAISubscriptionCredential;

/// <summary>
/// What is rendered here is written straight into a worker container's <c>~/.pi/agent/auth.json</c>,
/// so it has to be a record Pi accepts - it refuses one missing <c>type</c>, <c>access</c>,
/// <c>refresh</c> or <c>expires</c> as invalid_state.
/// </summary>
public class when_rendering_it_back : Specification
{
    static readonly OpenAISubscriptionCredential _credential = new("at", "rt", 4102444800000L, "acct");
    static readonly OpenAISubscriptionCredential _withoutAccount = new("at", "rt", 4102444800000L, null);

    [Fact] void should_round_trip_through_storage() => OpenAISubscriptionCredential.TryParse(_credential.ToApiKey()).ShouldEqual(_credential);
    [Fact] void should_round_trip_without_an_account_id() => OpenAISubscriptionCredential.TryParse(_withoutAccount.ToApiKey()).ShouldEqual(_withoutAccount);

    // Pi keys off the type, and a rendered record that lost it would be refused.
    [Fact] void should_declare_it_an_oauth_record() => _credential.ToApiKey().Value.ShouldContain("\"type\":\"oauth\"");

    // Still recognizable as a subscription credential once stored, or the whole routing falls back
    // to treating it as an API key and sends it to api.openai.com.
    [Fact] void should_still_be_recognized_as_a_subscription_credential() => OpenAICredential.IsSubscriptionCredential(_credential.ToApiKey()).ShouldBeTrue();
}

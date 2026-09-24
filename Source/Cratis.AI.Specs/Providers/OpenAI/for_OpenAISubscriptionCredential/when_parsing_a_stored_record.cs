// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.OpenAI.for_OpenAISubscriptionCredential;

/// <summary>
/// The stored credential is pasted in by a person out of Pi's own credential store, so it arrives in
/// whatever shape that file had - and every field the refresh depends on has to survive the round
/// trip, or the subscription silently stops working on the first rotation.
/// </summary>
public class when_parsing_a_stored_record : Specification
{
    [Fact] void should_read_the_access_token() => OpenAISubscriptionCredential.TryParse(Records.Complete)!.Access.ShouldEqual("at");
    [Fact] void should_read_the_refresh_token() => OpenAISubscriptionCredential.TryParse(Records.Complete)!.Refresh.ShouldEqual("rt");
    [Fact] void should_read_the_expiry() => OpenAISubscriptionCredential.TryParse(Records.Complete)!.Expires.ShouldEqual(4102444800000L);
    [Fact] void should_read_the_account_id() => OpenAISubscriptionCredential.TryParse(Records.Complete)!.AccountId.ShouldEqual("acct");

    // Pi does not require accountId, so neither does this.
    [Fact] void should_accept_a_record_without_an_account_id() => OpenAISubscriptionCredential.TryParse(Records.WithoutAccountId).ShouldNotBeNull();

    [Fact] void should_not_read_an_api_key() => OpenAISubscriptionCredential.TryParse("sk-abc").ShouldBeNull();
    [Fact] void should_not_read_a_truncated_record() => OpenAISubscriptionCredential.TryParse("""{"type":"oauth","access":"at""").ShouldBeNull();
    [Fact] void should_not_read_a_record_with_no_refresh_token() => OpenAISubscriptionCredential.TryParse("""{"type":"oauth","access":"at","expires":1}""").ShouldBeNull();
    [Fact] void should_not_read_a_record_with_no_expiry() => OpenAISubscriptionCredential.TryParse("""{"type":"oauth","access":"at","refresh":"rt"}""").ShouldBeNull();

    // A record whose expiry arrived as a string rather than a number must not sink the dispatch pass
    // with an exception on its way through.
    [Fact] void should_not_read_a_record_whose_expiry_is_not_a_number() => OpenAISubscriptionCredential.TryParse("""{"type":"oauth","access":"at","refresh":"rt","expires":"soon"}""").ShouldBeNull();
}

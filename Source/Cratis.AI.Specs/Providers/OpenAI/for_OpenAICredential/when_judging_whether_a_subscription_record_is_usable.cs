// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.OpenAI.for_OpenAICredential;

/// <summary>
/// A harness calls a stored OAuth record ready only when it carries the refresh token and expiry it
/// needs to keep itself authenticated. Some harnesses report anything less only from inside a
/// container that has already been launched, so the same judgement is made here, where a person can
/// still read the reason.
/// </summary>
public class when_judging_whether_a_subscription_record_is_usable : Specification
{
    [Fact] void should_accept_a_complete_record() => OpenAICredential.IsUsableSubscriptionCredential("""{"type":"oauth","access":"tok","refresh":"rt","expires":4102444800000}""").ShouldBeTrue();
    [Fact] void should_accept_a_record_carrying_an_account_id() => OpenAICredential.IsUsableSubscriptionCredential("""{"type":"oauth","access":"tok","refresh":"rt","expires":4102444800000,"accountId":"acct"}""").ShouldBeTrue();

    /// <summary>
    /// Exactly the four fields required - accountId is the one that is not needed.
    /// </summary>
    [Fact] void should_refuse_a_record_with_no_refresh_token() => OpenAICredential.IsUsableSubscriptionCredential("""{"type":"oauth","access":"tok","expires":4102444800000}""").ShouldBeFalse();
    [Fact] void should_refuse_a_record_with_no_expiry() => OpenAICredential.IsUsableSubscriptionCredential("""{"type":"oauth","access":"tok","refresh":"rt"}""").ShouldBeFalse();
    [Fact] void should_refuse_a_record_with_no_access_token() => OpenAICredential.IsUsableSubscriptionCredential("""{"type":"oauth","refresh":"rt","expires":4102444800000}""").ShouldBeFalse();

    /// <summary>
    /// A half-pasted record is JSON-shaped but not JSON, and must not sink the dispatch with an
    /// exception on its way through.
    /// </summary>
    [Fact] void should_refuse_a_truncated_record() => OpenAICredential.IsUsableSubscriptionCredential("""{"type":"oauth","access":"tok""").ShouldBeFalse();
    [Fact] void should_refuse_a_json_array() => OpenAICredential.IsUsableSubscriptionCredential("[]").ShouldBeFalse();
    [Fact] void should_refuse_an_api_key() => OpenAICredential.IsUsableSubscriptionCredential("sk-abc123").ShouldBeFalse();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.OpenAI.for_OpenAICredential;

/// <summary>
/// The two OpenAI credential kinds are pasted into the same "API key" field and only one of them
/// can reach the public API, so this is the one place the distinction is drawn - and the one that
/// decides whether a harness session runs on a ChatGPT subscription or on a metered key.
/// </summary>
public class when_classifying_a_credential : Specification
{
    const string SubscriptionRecord = """{"type":"oauth","access":"tok","refresh":"rt","expires":4102444800000}""";

    [Fact] void should_recognize_a_console_api_key() => OpenAICredential.IsSubscriptionCredential("sk-abc123").ShouldBeFalse();
    [Fact] void should_recognize_a_project_scoped_api_key() => OpenAICredential.IsSubscriptionCredential("sk-proj-abc123").ShouldBeFalse();
    [Fact] void should_recognize_a_subscription_record() => OpenAICredential.IsSubscriptionCredential(SubscriptionRecord).ShouldBeTrue();

    /// <summary>
    /// Pasted out of a harness's own auth store, a record routinely arrives with the whitespace it
    /// had there - which must not change what it is.
    /// </summary>
    [Fact] void should_recognize_a_record_that_was_pasted_with_leading_whitespace() => OpenAICredential.IsSubscriptionCredential("\n  " + SubscriptionRecord).ShouldBeTrue();

    [Fact] void should_not_treat_an_unset_credential_as_a_subscription() => OpenAICredential.IsSubscriptionCredential(AIProviderApiKey.NotSet).ShouldBeFalse();
    [Fact] void should_not_treat_a_blank_credential_as_a_subscription() => OpenAICredential.IsSubscriptionCredential("   ").ShouldBeFalse();
}

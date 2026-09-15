// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_AnthropicCredential;

/// <summary>
/// The two Anthropic credential kinds are pasted into the same "API key" field and differ only by
/// prefix, so this is the one place the distinction is drawn - and the one that decides whether a
/// worker session and a chat completion authenticate or 401.
/// </summary>
public class when_classifying_a_credential : Specification
{
    [Fact] void should_recognize_a_setup_token_as_an_oauth_token() => AnthropicCredential.IsOAuthToken("sk-ant-oat01-abc123").ShouldBeTrue();
    [Fact] void should_not_mistake_a_console_api_key_for_an_oauth_token() => AnthropicCredential.IsOAuthToken("sk-ant-api03-abc123").ShouldBeFalse();
    [Fact] void should_treat_an_unset_credential_as_an_api_key() => AnthropicCredential.IsOAuthToken(AIProviderApiKey.NotSet).ShouldBeFalse();

    /// <summary>
    /// The prefix carries meaning, so the match is anchored - a key that merely contains the marker
    /// somewhere in its body is still an API key.
    /// </summary>
    [Fact] void should_only_match_the_prefix() => AnthropicCredential.IsOAuthToken("sk-ant-api03-sk-ant-oat01").ShouldBeFalse();
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_AnthropicCredential;

public class when_the_credential_contains_pasted_whitespace : Specification
{
    const string PastedToken = " \t\r\nsk-ant-oat01-ab\n c123\u00a0";

    [Fact] void should_recognize_the_wrapped_oauth_token() => AnthropicCredential.IsOAuthToken(PastedToken).ShouldBeTrue();

    [Fact] void should_send_the_normalized_bearer_token() =>
        AnthropicCredential.HeadersFor(PastedToken).ShouldContain(new KeyValuePair<string, string>("Authorization", "Bearer sk-ant-oat01-abc123"));

    [Fact] void should_keep_the_oauth_beta_header() =>
        AnthropicCredential.HeadersFor(PastedToken).ShouldContain(new KeyValuePair<string, string>("anthropic-beta", "oauth-2025-04-20"));

    [Fact] void should_not_send_the_oauth_token_as_an_api_key() =>
        AnthropicCredential.HeadersFor(PastedToken).Any(header => header.Key == "x-api-key").ShouldBeFalse();

    [Fact] void should_normalize_a_console_key_without_changing_its_authentication_kind() =>
        AnthropicCredential.HeadersFor(" \nsk-ant-api03-ab\r\nc123\t").ShouldContain(new KeyValuePair<string, string>("x-api-key", "sk-ant-api03-abc123"));

    [Fact] void should_expose_the_normalized_value_for_worker_credentials() => AnthropicCredential.Normalize(PastedToken).Value.ShouldEqual("sk-ant-oat01-abc123");

    [Fact] void should_preserve_an_unset_credential() => AnthropicCredential.Normalize(AIProviderApiKey.NotSet).ShouldEqual(AIProviderApiKey.NotSet);

    [Fact] void should_not_match_a_prefix_embedded_in_an_api_key() => AnthropicCredential.IsOAuthToken(" sk-ant-api03-sk-ant-oat01 ").ShouldBeFalse();
}

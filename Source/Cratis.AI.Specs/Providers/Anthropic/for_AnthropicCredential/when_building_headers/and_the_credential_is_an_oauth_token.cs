// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_AnthropicCredential.when_building_headers;

public class and_the_credential_is_an_oauth_token : Specification
{
    IReadOnlyList<KeyValuePair<string, string>> _headers;

    void Because() => _headers = AnthropicCredential.HeadersFor("sk-ant-oat01-abc123");

    [Fact]
    void should_send_the_token_as_a_bearer() =>
        _headers.ShouldContain(new KeyValuePair<string, string>("Authorization", "Bearer sk-ant-oat01-abc123"));

    [Fact]
    void should_enable_the_oauth_beta() =>
        _headers.ShouldContain(new KeyValuePair<string, string>("anthropic-beta", "oauth-2025-04-20"));

    [Fact]
    void should_not_send_it_as_an_api_key() =>
        _headers.Any(header => header.Key == "x-api-key").ShouldBeFalse();
}

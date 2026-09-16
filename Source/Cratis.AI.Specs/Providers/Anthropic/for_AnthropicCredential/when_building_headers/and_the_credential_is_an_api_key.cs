// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.Anthropic.for_AnthropicCredential.when_building_headers;

public class and_the_credential_is_an_api_key : Specification
{
    IReadOnlyList<KeyValuePair<string, string>> _headers;

    void Because() => _headers = AnthropicCredential.HeadersFor("sk-ant-api03-abc123");

    [Fact]
    void should_send_the_api_key_header() =>
        _headers.ShouldContain(new KeyValuePair<string, string>("x-api-key", "sk-ant-api03-abc123"));

    [Fact]
    void should_not_send_an_authorization_header() =>
        _headers.Any(header => header.Key == "Authorization").ShouldBeFalse();
}

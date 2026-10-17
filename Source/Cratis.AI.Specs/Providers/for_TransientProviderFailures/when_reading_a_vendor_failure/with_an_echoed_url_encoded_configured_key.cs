// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_an_echoed_url_encoded_configured_key : given.a_vendor_response
{
    const string Key = "ab+c/d=e";
    const string Encoded = "ab%2Bc%2Fd%3De";

    void Establish() => _response.Content = new StringContent($$$"""{"error":{"message":"invalid key {{{Encoded}}}"}}""");
    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAICompatible, "gpt-4", _providerId, new AIProviderApiKey(Key));

    [Fact] void should_withhold_the_encoded_key() => _failure.Body.ShouldNotContain(Encoded);
    [Fact] void should_mark_the_redaction() => _failure.Body.ShouldContain("[redacted]");
}

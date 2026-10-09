// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_echoed_credentials : given.a_vendor_response
{
    const string Key = "sk-secret-vendor-key";
    const string Token = "a.short.token";
    const string Encoded = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=";
    const string Hex = "0123456789abcdef0123456789abcdef0123456789abcdef";

    void Establish() => _response.Content = new StringContent($$$"""{"error":{"type":"{{{Key}}}","code":"Bearer {{{Token}}}","message":"{{{Encoded}}} {{{Hex}}}"}}""");

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAI, "gpt-4", _providerId);

    [Fact] void should_withhold_the_key_from_the_body() => _failure.Body.ShouldNotContain(Key);
    [Fact] void should_withhold_the_bearer_token_from_the_body() => _failure.Body.ShouldNotContain(Token);
    [Fact] void should_withhold_the_encoded_token_from_the_body() => _failure.Body.ShouldNotContain(Encoded);
    [Fact] void should_withhold_the_hex_token_from_the_body() => _failure.Body.ShouldNotContain(Hex);
    [Fact] void should_withhold_the_key_from_the_reason() => _failure.Result.FailureReason.ShouldNotContain(Key);
    [Fact] void should_withhold_the_bearer_token_from_the_reason() => _failure.Result.FailureReason.ShouldNotContain(Token);
    [Fact] void should_mark_the_redaction() => _failure.Body.ShouldContain("[redacted]");
}

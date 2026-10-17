// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_an_echoed_configured_key : given.a_vendor_response
{
    const string Key = "hunter2";

    void Establish() => _response.Content = new StringContent($$$"""{"error":{"message":"invalid key {{{Key}}}"},"detail":"{{{Key}}}"}""");
    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAICompatible, "gpt-4", _providerId, new AIProviderApiKey(Key));

    [Fact] void should_withhold_the_short_key_from_the_body() => _failure.Body.ShouldNotContain(Key);
    [Fact] void should_withhold_the_short_key_from_the_reason() => _failure.Result.FailureReason.ShouldNotContain(Key);
    [Fact] void should_mark_the_redaction() => _failure.Body.ShouldContain("[redacted]");
}

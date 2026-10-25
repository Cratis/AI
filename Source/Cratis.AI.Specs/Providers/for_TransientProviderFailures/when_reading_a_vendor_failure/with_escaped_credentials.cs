// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_escaped_credentials : given.a_vendor_response
{
    void Establish() => _response.Content = new StringContent("""{"error":{"message":"\u0073\u006b-secret-key"}}""");

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.Anthropic, "claude-sonnet-4", _providerId);

    [Fact] void should_withhold_the_escaped_key() => _failure.Body.ShouldNotContain("secret-key");
    [Fact] void should_mark_the_redaction() => _failure.Body.ShouldContain("[redacted]");
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_truncated_credential : given.a_vendor_response
{
    void Establish() => _response.Content = new StringContent(new string(' ', 2044) + "abcdefgh0123456789abcdefgh0123456789");

    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAI, "gpt-4", _providerId);

    [Fact] void should_withhold_the_partial_token() => _failure.Body.ShouldNotContain("abcd");
    [Fact] void should_still_bound_the_body() => (_failure.Body.Length <= 2048).ShouldBeTrue();
}

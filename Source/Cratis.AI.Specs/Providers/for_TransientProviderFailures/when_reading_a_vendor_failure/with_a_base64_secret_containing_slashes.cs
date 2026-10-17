// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.for_TransientProviderFailures.when_reading_a_vendor_failure;

public class with_a_base64_secret_containing_slashes : given.a_vendor_response
{
    const string First = "Zm9vYmFy/YmF6cXV4cXV1eA";
    const string Second = "c2VjcmV0L3ZhbHVl/MTIzNDU2Nzg5";
    const string Secret = $"{First}/{Second}";

    void Establish() => _response.Content = new StringContent($$$"""{"error":{"message":"bad key {{{Secret}}} supplied"}}""");
    async Task Because() => _failure = await TransientProviderFailures.FromResponse(_response, AIProviderType.OpenAICompatible, "gpt-4", _providerId);

    [Fact] void should_withhold_the_secret_from_the_body() => _failure.Body.ShouldNotContain(Secret);
    [Fact] void should_withhold_the_first_segment_from_the_body() => _failure.Body.ShouldNotContain(First);
    [Fact] void should_withhold_the_second_segment_from_the_body() => _failure.Body.ShouldNotContain(Second);
    [Fact] void should_withhold_the_secret_from_the_reason() => _failure.Result.FailureReason.ShouldNotContain(First);
    [Fact] void should_mark_the_redaction() => _failure.Body.ShouldContain("[redacted]");
}
